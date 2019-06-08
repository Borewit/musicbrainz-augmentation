import * as assert from 'assert';

import * as Debug from 'debug';

import * as spotify from './spotify/spotify.types';
import * as mb from 'musicbrainz-api';

import { similarity, removeBrackets } from './StringUtils';
import { IAlbumSearchQuery, SpotifyClient, ISpotifyConfig } from './spotify/SpotifyClient';

const debug = Debug('musicbrainz:augment:spotify');

const releaseDeltaSettings = {
  maxDeltaTrackDuration: 5000, // ms
  minTrackSimilarity: 0.5 // ms
};

export interface IAugmentationConfig {
  spotify: ISpotifyConfig;
  musicBrainz?: mb.IMusicBrainzConfig;
  options: {
    validateSpotifyLink: true;
  }
}

const releaseIncludes: mb.Includes[] = ['recordings', 'artists', 'artist-credits', 'isrcs', 'url-rels', 'release-groups'];

const editNoteSpotifyUrl = `Linked Spotify track with recording, based on release/album similarity: number of tracks, track length (±${releaseDeltaSettings.maxDeltaTrackDuration} sec.), album title, artist and track names. Script is using on musicbrainz-api (https://github.com/Borewit/musicbrainz-augmentation)`;

const editNoteSpotifyIsrcs = `ISRCs looked up using Spotify API, based on release/album similarity: number of tracks, track length (±${releaseDeltaSettings.maxDeltaTrackDuration} sec.), album title, artist and track names. Script is using on musicbrainz-api (https://github.com/Borewit/musicbrainz-augmentation)`;

export class AugmentFromSpotify {

  public static isSameRelease(mbRelease: mb.IRelease, spotifyAlbum: spotify.IAlbum): boolean {

    const mbTotalTracks = AugmentFromSpotify.countMbReleaseTracks(mbRelease);
    if (mbTotalTracks !== spotifyAlbum.total_tracks) {
      debug(`Total number of track mismatch ${mbTotalTracks} vs ${spotifyAlbum.total_tracks}`);
      return false;
    }

    for (const medium of mbRelease.media) {
      for (const track of medium.tracks) {
        debug(`medium pos=${medium.position}, track: pos=${track.position},title='${track.title}' mbid=${track.id}`);
        const recording = track.recording;
        debug(`recording:     title='${recording.title}' mbid=${ recording.id}`);
        const spotifyTrack = AugmentFromSpotify.getSpotifyTrack(spotifyAlbum, medium.position, track.position);
        if (!spotifyTrack) {
          debug(`Track not found in Spotify release: medium=${medium.position}, track=${track.position}`);
          return false;
        }
        if (spotifyTrack.name === 'Hidden Track') {
          if (track.title === '[untitled]') {
            continue;
          }
          debug(`Track name mismatch Spotify: ${spotifyTrack.name}, MusicBrainz: ${track.title}`);
          return false;
        }

        let score = similarity(AugmentFromSpotify.normalizeTrackName(spotifyTrack.name), AugmentFromSpotify.normalizeTrackName(track.title));

        if (score < releaseDeltaSettings.minTrackSimilarity) {
          if (score < 0.15) {
            debug(`Track name mismatch: score=${score}: Spotify: ${spotifyTrack.name}, MusicBrainz: ${track.title}`);
            return false;
          }
          const spName = removeBrackets(spotifyTrack.name);
          const mbName = removeBrackets(track.title);
          score = similarity(spName, mbName);
          if (score < releaseDeltaSettings.minTrackSimilarity) {
            debug(`Track name mismatch: score=${score}: Spotify: ${spotifyTrack.name}, MusicBrainz: ${track.title}`);
            return false;
          }
        }

        const delta = spotifyTrack.duration_ms - track.recording.length;
        if (delta > releaseDeltaSettings.maxDeltaTrackDuration) {
          debug(`Rec: score=${score}`);
          debug(`Track delta to high ${delta}>${releaseDeltaSettings.maxDeltaTrackDuration} of ${medium.position}.${track.position} - ${track.title}`);
          return false;
        }
      }
    }
    debug(`Found match`);
    return true;
  }

  public static normalizeTrackName(trackName: string): string {
    return trackName.replace('- Live', '');
  }

  public static countMbReleaseTracks(mbRelease: mb.IRelease): number {
    let trackCount = 0;
    mbRelease.media.forEach(m => trackCount += m.tracks.length);
    return trackCount;
  }

  /**
   * 'ushm91328810' becomes 'USHM91328810'
   * 'NL-Z07-08-00012' becomes 'NLZ070800012'
   * @param isrc
   */
  public static normalizeSpotifyIsrc(isrc: string) {
    return isrc.trim().toUpperCase().replace(/-/g, '');
  }

  private static getSpotifyTrack(album: spotify.IAlbum, discNr: number, trackNr: number): spotify.ITrack {
    for (const track of album.tracks.items) {
      if (track.disc_number === discNr && track.track_number === trackNr) {
        return track;
      }
    }
  }

  public skipFilledIsrcs = false;

  private spotifyClient: SpotifyClient;
  private mbClient: mb.MusicBrainzApi;

  public constructor(private config: IAugmentationConfig) {
    this.spotifyClient = SpotifyClient.instance(config.spotify);
    this.mbClient = new mb.MusicBrainzApi(config.musicBrainz);
  }

  public getMusicBrainzRelease(mbid_release: string): Promise<mb.IRelease> {
    return this.mbClient.getRelease(mbid_release, releaseIncludes);
  }

  public async getSpotifyAlbum(albumId: string): Promise<spotify.IAlbum> {
    const album = await this.spotifyClient.getAlbum(albumId);
    await this.spotifyClient.getRemainingTracks(album);
    return album;
  }

  public async searchSpotifyAlbums(mbid_release: string): Promise<string[]> {

    const release = await this.mbClient.getRelease(mbid_release, releaseIncludes);
    assert.ok(release.media, 'release.media should be defined');
    let spotifyIds: string[] = [];
    if (release.relations) {
      spotifyIds = release.relations
        .filter(rel => rel['target-type'] === 'url')
        .filter(rel => rel.url.resource.startsWith('https://open.spotify.com/album/'))
        .map(rel => rel.url.resource.substring(31));

      if (this.config.options.validateSpotifyLink) {
        // Validate Spotify link
        const validatedIds = [];

        for (const spotifyId of spotifyIds) {
          const album = await this.getSpotifyAlbum(spotifyId);
          if (AugmentFromSpotify.isSameRelease(release, album)) {
            validatedIds.push(spotifyId);
          } else {
            debug(`It looks like MB-release ${release.id} is pointing to a different Spotify release`);
          }
        }
        spotifyIds = validatedIds;
      }
     }

    if (spotifyIds.length === 0) {
      const query: IAlbumSearchQuery = {};

      if (release['artist-credit'] && release['artist-credit'].length >= 1) {
        query.artist = release['artist-credit'][0].name; // Only use the first artist credit
      }

      query.album = release.title;

      const searchResult = await this.spotifyClient.searchAlbums(query);

      if (searchResult.albums) {
        await Promise.all(searchResult.albums.items.map(album => this.spotifyClient.getRemainingTracks(album)));

        spotifyIds = searchResult.albums.items
          .filter(album => AugmentFromSpotify.isSameRelease(release, album))
          .map(album => album.id);
      }
    }

    if (spotifyIds.length === 0) {
      debug(`No releases found for: ${release.title}`);
    }

    return spotifyIds;
  }

  public async addIsrcsToRelease(mbid_release: string, spotifyAlbumId: string): Promise<void> {

    const release = await this.mbClient.getRelease(mbid_release, releaseIncludes);

    const spotifyAlbum = await this.spotifyClient.getAlbum(spotifyAlbumId);

    assert.ok(release);

    const xmlMetadata = new mb.XmlMetadata();

    for (const medium of release.media) {
      for (const track of medium.tracks) {
        debug(`medium pos=${medium.position}, track: pos=${track.position},title='${track.title}' mbid=${track.id}`);
        const recording = track.recording;
        debug(`recording:     title='${recording.title}' mbid=${ recording.id}`);
        let spotifyTrack = AugmentFromSpotify.getSpotifyTrack(spotifyAlbum, medium.position, track.position);
        if (spotifyTrack) {
          // Get track with more detail (from ISRC)
          spotifyTrack = await this.spotifyClient.getTrack(spotifyTrack.id);

          if (spotifyTrack.external_ids.isrc) {
            const spotify_isrc = AugmentFromSpotify.normalizeSpotifyIsrc(spotifyTrack.external_ids.isrc);
            debug(`spotify track: title='${spotifyTrack.name}' id=${spotifyTrack.id}, isrc=${spotify_isrc}`);
            assert(recording.isrcs, 'Expect recording.isrcs to be defined');
            if (this.skipFilledIsrcs && recording.isrcs.find(isrc => isrc === spotify_isrc)) {
              debug(`ISRC already present: title='${spotifyTrack.name}' mbid=${ spotifyTrack.id}, isrc=${spotify_isrc}`);
            } else {
              const xmlRecording = xmlMetadata.pushRecording(recording.id);
              xmlRecording.isrcList.pushIsrc(spotify_isrc);
            }
          }
          // Add Spotify URL to recording
          debug(`Link recording[id=${track.recording.id}, title='${track.recording.title}'] to spotify[id=${spotifyTrack.id}]`);
          try {
            await this.mbClient.addSpotifyIdToRecording(track.recording, spotifyTrack.id, editNoteSpotifyUrl);
          } catch (err) {
            debug(`Failed to add Spotify link for recording[id=${track.recording.id}, title='${track.recording.title}'] to spotify[id=${spotifyTrack.id}]: ${err.message}`);
          }
        }
      }
    }
    debug(xmlMetadata.toXml());

    if (xmlMetadata.recordings.length > 0) {
      debug(`Posting mbid=${release.id}...`);
      await this.mbClient.post('recording', xmlMetadata);
      debug(`ISRC's added to: title=${release.title}, mbid=${release.id}`);
    } else {
      debug(`No ISRCs to add for title=${release.title}, mbid=${release.id}`);
    }
  }

  public async augmentReleaseWithSpotifyAlbum(mbid_release: string, spotifyAlbumId: string): Promise<void> {

    const release = await this.mbClient.getRelease(mbid_release, releaseIncludes);

    const spotifyAlbum = await this.spotifyClient.getAlbum(spotifyAlbumId);

    assert.ok(release);

    for (const medium of release.media) {
      for (const track of medium.tracks) {
        debug(`medium pos=${medium.position}, track: pos=${track.position},title='${track.title}' mbid=${track.id}`);
        const recording = track.recording;
        debug(`recording:     title='${recording.title}' mbid=${ recording.id}`);
        let spotifyTrack = AugmentFromSpotify.getSpotifyTrack(spotifyAlbum, medium.position, track.position);
        if (spotifyTrack) {
          // Get track with more detail (from ISRC)
          spotifyTrack = await this.spotifyClient.getTrack(spotifyTrack.id);

          if (spotifyTrack.external_ids.isrc) {
            const spotify_isrc = AugmentFromSpotify.normalizeSpotifyIsrc(spotifyTrack.external_ids.isrc);
            debug(`spotify track: title='${spotifyTrack.name}' id=${spotifyTrack.id}, isrc=${spotify_isrc}`);
            assert(recording.isrcs, 'Expect recording.isrcs to be defined');
            if (this.skipFilledIsrcs && recording.isrcs.find(isrc => isrc === spotify_isrc)) {
              debug(`ISRC already present: title='${spotifyTrack.name}' mbid=${spotifyTrack.id}, isrc=${spotify_isrc}`);
            } else {
              debug(`Add ISRC to recording='${spotifyTrack.name}' mbid=${spotifyTrack.id}, isrc=${spotify_isrc}`);
              recording.isrcs.push(spotify_isrc);
            }
          }
          // Add Spotify URL to recording, and update ISRC values
          debug(`Link recording[id=${track.recording.id}, title='${track.recording.title}'] to spotify[id=${spotifyTrack.id}]`);
          try {
            await this.mbClient.addSpotifyIdToRecording(track.recording, spotifyTrack.id, editNoteSpotifyUrl);
          } catch (err) {
            debug(`Failed to add Spotify link for recording[id=${track.recording.id}, title='${track.recording.title}'] to spotify[id=${spotifyTrack.id}]: ${err.message}`);
          }
        }
      }
    }
  }

  public async augmentArtist(artistId: string) {
    const artist = await this.mbClient.getArtist(artistId, ["releases"]);
    assert.strictEqual(artist.id, artistId);
    for (const release of artist.releases) {
      this.augmentRelease(release.id);
    }
  }

  public async augmentRelease(mbid_release: string) {
    const spotAlbumIds = await this.searchSpotifyAlbums(mbid_release);
    if (spotAlbumIds.length > 0) {
      await this.augmentReleaseWithSpotifyAlbum(mbid_release, spotAlbumIds[0]);
    } else {
      debug(`Warning: Could not find album mbid=${mbid_release})`);
    }
  }

}
