import {assert} from 'chai';

import { AugmentFromSpotify } from '../lib/AugmentFromSpotify';
import * as config from '../etc/config';

async function isSameRelease(augmentFromSpotify: AugmentFromSpotify, mbid_release: string, spotifyId: string): Promise<boolean> {

  const release = await augmentFromSpotify.getMusicBrainzRelease(mbid_release);
  const album = await augmentFromSpotify.getSpotifyAlbum(spotifyId);
  return AugmentFromSpotify.isSameRelease(release, album );
}

describe('Test bot account', () => {

  const augment = new AugmentFromSpotify(config);

  it('should be able to login', () => {

  });

  describe('Compare release', async () => {

    it('Corresponding release: Jacinthe - Found', async () => {
      assert.isTrue(await isSameRelease( augment, '0ed6e2f1-4fa4-48da-8e41-bfeff3e93db3', '3tDHghTVfKIRwoZ2cVDhdf'));
    });

    it('Different release: Jacinthe - Found, different track sequence', async () => {
      assert.isFalse(await isSameRelease( augment, '0ed6e2f1-4fa4-48da-8e41-bfeff3e93db3', '02GYCqiZFcCSW6EaO5pE2f'));
    });

  });

  describe('Find MusicBrainz Spotify pairs', () => {

    it('Find the right album of Jacinthe - Found', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('4a299a6f-f7c4-4555-97c5-dd13e93a24cb');
      assert.deepEqual(spotifyAlbums, ['02GYCqiZFcCSW6EaO5pE2f']);
    });

    it('Find the right album of Jacinthe - Found', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('0ed6e2f1-4fa4-48da-8e41-bfeff3e93db3');
      assert.deepEqual(spotifyAlbums, ['3tDHghTVfKIRwoZ2cVDhdf']);
    });

  })

})
;
