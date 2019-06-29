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

    it('Find the right album of Jacinthe - Found {3614971265640}', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('4a299a6f-f7c4-4555-97c5-dd13e93a24cb');
      assert.deepEqual(spotifyAlbums, ['02GYCqiZFcCSW6EaO5pE2f']);
    });

    it('Find the right album of Jacinthe - Found', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('0ed6e2f1-4fa4-48da-8e41-bfeff3e93db3');
      assert.deepEqual(spotifyAlbums, ['3tDHghTVfKIRwoZ2cVDhdf']);
    });

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

    it('We Are Friends, Volume 8', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('f62c8292-4b23-4ad1-818f-0b9c94139ed4');
      assert.deepEqual(spotifyAlbums, ['1IFiPfRCcOFei774vVJOMS']);
    });

    it('Doe Maar - Skunk', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('eb91b17b-1f07-47a1-8975-b49c07974e68');
      assert.deepEqual(spotifyAlbums, ['2x9206iES3jSpMrduTXVGH']);
    });

    it('Doe Maar - 4us', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('dc37ab9f-4c1f-45ac-ba81-65f2d6ddc36c');
      assert.deepEqual(spotifyAlbums, ['1d27T3U7K7WixFp0Ja6pLz']);
    });

    it('Doe Maar - Hees van Ahoy', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('2ea35603-b740-473e-839d-5af9b08c87df');
      assert.deepEqual(spotifyAlbums, ['3MxMrQXRK6BrwAIDizysnO']);
    });

    it('Philharmonics (Deluxe Edition)', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('f7aedffa-1e6e-49a2-bf84-1ac57ca77cbc');
      assert.deepEqual(spotifyAlbums, ['3L7Pp3ZCby3Ho9gOWqaXxI']);
    });

    it('Queen - Flash Gordon', async () => {
      const spotifyAlbums = await augment.searchSpotifyAlbums('c8a6c0d4-1fe4-4940-a0df-cfb112f9800c');
      assert.deepEqual(spotifyAlbums, ['4r9kNse038AoF2KfbqPUOS']);
    });

  });

  describe('Augment', () => {

    async function augmentRelease(mbid: string) {
      const spotifyAlbums = await augment.searchSpotifyAlbums(mbid);
      assert.deepEqual(spotifyAlbums, ['1IFiPfRCcOFei774vVJOMS']);

      await augment.augmentReleaseWithSpotifyAlbum(mbid, spotifyAlbums[0]);
    }

    it('twice', async () => {
      await augmentRelease('f62c8292-4b23-4ad1-818f-0b9c94139ed4');
    });

  });

})
;
