import {assert} from 'chai';

import { AugmentFromSpotify } from '../lib/AugmentFromSpotify';
import * as config from '../etc/config';

async function isSameRelease(augmentFromSpotify: AugmentFromSpotify, mbid_release: string, spotifyId: string): Promise<boolean> {

  const release = await augmentFromSpotify.getMusicBrainzRelease(mbid_release);
  const album = await augmentFromSpotify.getSpotifyAlbum(spotifyId);
  return AugmentFromSpotify.isSameRelease(release, album);
}

describe('Test bot account', () => {

  const augment = new AugmentFromSpotify(config);

  describe('Compare release', async () => {

    it('Corresponding release: Jacinthe - Found', async () => {
      assert.isTrue(await isSameRelease(augment, '0ed6e2f1-4fa4-48da-8e41-bfeff3e93db3', '3tDHghTVfKIRwoZ2cVDhdf'));
    });

    it('Different release: Jacinthe - Found, different track sequence', async () => {
      assert.isFalse(await isSameRelease(augment, '0ed6e2f1-4fa4-48da-8e41-bfeff3e93db3', '02GYCqiZFcCSW6EaO5pE2f'));
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

  });

  describe('Augment', () => {

    it('Rainer Scheuerenbrand - Diosana', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('e1e19926-ea67-4155-b8b5-0705ba832d8d');
      assert.deepEqual(spotifyAlbums, ['5mlqXNTiKfWpX6Yldsdwjy']);
    });

    it('Joy Wellboy - Wedding {13 track version}', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('c1a790b8-d06f-4f0c-8981-ff6f3236a07c');
      assert.deepEqual(spotifyAlbums, ['0J6r9xiLQ9RGEQ7OPyO7oZ']);
    });

    it('L.A. Salami - Another Shade of Blue', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('20e3e2fa-57e4-4c78-817b-86e0cb160eac');
      assert.deepEqual(spotifyAlbums, ['75eTM88MOWx11QY8V2bPiD']);
    });

  });

})
;
