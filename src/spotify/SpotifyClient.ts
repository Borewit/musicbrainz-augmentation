"use strict";

import * as Debug from "debug";
import * as crypto from "crypto";
import * as SpotifyWebApi from "spotify-web-api-node";
import * as assert from "assert";
import IAccessToken = SpotifyWebApi.IAccessToken;
import * as Path from "path";
import * as spotify from "./spotify.types";

import { Fs } from './Fs';

const debug = Debug("spotify:client");

export interface ISpotifyConfig {
  clientId: string,
  clientSecret: string,
  tokenFile: string
}

interface ISpotifyAuthorizationCode {
  code: string,
  state: string
}

export interface ISpotifyWebapiError {
  name: string,
  message: string,
  statusCode: number
}

export interface IAlbumSearchQuery {
  artist?: string,
  album?: string
}

interface ISpotifyAuthorizationToken {
  /**
   * An access token that can be provided in subsequent calls, for example to Spotify Web API services.
   */
  access_token?: string,
  /**
   * How the access token may be used: always "Bearer".
   */
  token_type?: string,

  /**
   * The time period (in seconds) for which the access token is valid.
   */
  expires_in?: number,

  /**
   * A token that can be sent to the Spotify Accounts service in place of an authorization code.
   * (When the access code expires, send a POST request to the Accounts service /api/token endpoint,
   * but use this code in place of an authorization code.
   * A new access token will be returned.
   * A new refresh token might be returned too.)
   */
  refresh_token?: string

  scope?: string;
}

interface ISpotifyAuthorizationResponse {
  body: ISpotifyAuthorizationToken
}

let singleton: SpotifyClient;

export class SpotifyClient {

  public static instance(config: ISpotifyConfig): SpotifyClient {
    if (!singleton) {
      singleton = new SpotifyClient(config);
    }
    return singleton;
  }

  private static scopes = ["playlist-read-private", "user-read-private", "user-read-email", "playlist-read-collaborative", "user-follow-modify", "user-library-read", "user-read-recently-played"];

  /**
   * API instance used for requesting Authentication
   */
  private authenticationApi: SpotifyWebApi;

  /**
   * API instance used with access token
   */
  private rpcApi: SpotifyWebApi;

  private config: ISpotifyConfig;
  private tokenPath: string;

  /**
   * Cross-site request forgery (CSRF) clientToken;
   */
  private clientTokens = {};

  private constructor(config: ISpotifyConfig) {
    this.config = config;
    this.tokenPath = Path.resolve(__dirname, "../../", this.config.tokenFile);
    debug("Spotify token path: %s", this.tokenPath);
  }

  public async isUserLoginRequired(): Promise<boolean> {
    try {
      return !await this.getRpcApi();
    } catch (err) {
        return true;
    }
  }

  /**
   * Redirect to Spotify login, user granting API access.
   * Will also set client-token (state) which is checked in the 'callback'
   * @redirectUri Is the redirect URL to which spotify login will redirect
   * @redirectPath Is used after redirectUri is used which will complete the authorization and redirect back to the original request URL
   */
  public createAuthorizeURL(redirectUri: string, redirectPath: string) {
    debug("Redirecting to Spotify login to grant API access, setting callback url to: " + redirectUri);

    const token = crypto.randomBytes(64).toString("hex");
    this.clientTokens[token] = redirectPath;

    this.authenticationApi = new SpotifyWebApi({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri
    });
    return this.authenticationApi.createAuthorizeURL(SpotifyClient.scopes, token);
  }

  public async getRpcApi(): Promise<SpotifyWebApi> {
    if (!this.rpcApi) {
      this.rpcApi = await this.refreshAccess();
    }
    return this.rpcApi;
  }

  /**
   * Authorization Code flow (signed by a user)
   * Client Credentials flow (application authentication - the user isn't involved)
   * @returns Promise<string> redirect path
   */
  public async authorizeUserCallback(code: ISpotifyAuthorizationCode): Promise<string> {
    if (!code.code) {
      throw new Error("Authorization code missing");
    } else if (!code.state) {
      throw new Error("Authorization state missing");
    } else {
      const redirectPath = this.clientTokens[code.state];
      if (!redirectPath) {
        throw new Error("CSRF Token (State) mismatch");
      }
      delete this.clientTokens[code.state];

      debug("Spotify authorization-code-grant with code: %s", code.code);
      try {
        const data: ISpotifyAuthorizationResponse = await this.authenticationApi.authorizationCodeGrant(code.code);
        await this.handleAuthenticationResponse(data);
        return redirectPath;
      } catch (err) {
        debug("Authorization code grant failed: %s", err.message);
        throw err;
      }

    }
  }

  /**
   * Authorization Code flow (signed by api[a user)
   * Client Credentials flow (application authentication - the user isn't involved)
   */
  public async refreshAccess(): Promise<SpotifyWebApi> {

    const refreshToken = await this.getRefreshToken();

    const spotifyApi = new SpotifyWebApi({
      refreshToken,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret
    });
    const data: ISpotifyAuthorizationResponse = await spotifyApi.refreshAccessToken();
    return this.handleAuthenticationResponse(data);
  }

  public async getAlbum(albumId: string): Promise<spotify.IAlbum> {
    const album = await this.apiCall<spotify.IAlbum>('getAlbum', arguments);
    return this.getRemainingTracks(album);
  }

  public getTrack(trackId: string): Promise<spotify.ITrack> {
    return this.apiCall<spotify.ITrack>('getTrack', arguments);
  }

  public async getRemainingTracks(album: spotify.IAlbum): Promise<spotify.IAlbum> {
    if (!album.tracks) {
      album.tracks = await this.getAlbumTracks(album.id);
    }
    while (album.tracks.offset + album.tracks.items.length < album.tracks.total) {
      const newTracks = await this.getAlbumTracks(album.id, {offset: album.tracks.offset + album.tracks.items.length});
      album.tracks.items.push(...newTracks.items);
    }
    return album;
  }

  public getAlbumTracks(data, options?: { offset: number, limit?: number }): Promise<spotify.ILimitedResult<spotify.ITrack>> {
    return this.apiCall('getAlbumTracks', arguments);
  }

  public searchAlbums(query: IAlbumSearchQuery): Promise<{ albums: spotify.ILimitedResult<spotify.IAlbum> }> {
    const textQuery = Object.keys(query).filter(key => query[key]).map(key => `${key}:"${query[key]}"`).join(' ');
    debug(`Search album query=${textQuery}`);
    return this.apiCall<{ albums: spotify.ILimitedResult<spotify.IAlbum> }>('searchAlbums', [textQuery]);
  }

  public async apiCall<T>(method: string, args: any, attempt = 0): Promise<T> {
    debug(`method=${method} arguments=${JSON.stringify(args)}`);
    try {
      const api = await this.getRpcApi();
      if (!api[method]) {
        throw new Error(`Method '${method}' not found`);
      }
      const resp = await api[method].apply(api, args);
      return resp.body;
    } catch (err) {
      if (err.statusCode === 401) {
        if (attempt === 0) {
          // Access token is probably expired
          debug("Access token is probably expired, trying to renew");
          const api = await this.refreshAccess();
          return this.apiCall<T>(method, args, attempt + 1);
        } else {
          err.message = "Failed to renew access-token: " + err.message;
          throw err;
        }
      }
      throw err;
    }
  }

  /**
   * Handle authentication response, from 'authorizationCodeGrant' or 'refreshAccessToken'
   * @param resp ISpotifyAuthorizationResponse
   * @returns {SpotifyWebApi}
   */
  private async handleAuthenticationResponse(resp: ISpotifyAuthorizationResponse): Promise<SpotifyWebApi> {
    if (resp.body.refresh_token) {
      // Save the refresh token so that it's used in future calls
      this.authenticationApi.setRefreshToken(resp.body.refresh_token);
      await this.writeToken(resp.body.refresh_token);
      debug("The access token expires in %s", resp.body.expires_in);
      debug("The access token is: %s", resp.body.access_token);
      // ToDo: store expiration
      // Init RPC API
    }
    return this.initRpcApi(resp.body.access_token); // Success
  }

  private initRpcApi(accessToken: string) {
    // Init RPC API
    this.rpcApi = new SpotifyWebApi({
      accessToken
    });
    assert.ok(this.rpcApi, "SpotifyWebApi should return an instance");
    return this.rpcApi;
  }

  private writeToken(token): Promise<void> {
    debug("Saving Spotify refresh-token: " + token);
    if (!token)
      return Promise.reject<void>(new Error("Cannot write an empty token"));
    return Fs.writeFile(this.tokenPath, token);
  }

  private loadToken(): Promise<IAccessToken> {
    return Fs.readTextFile(this.tokenPath, {encoding: "utf8"}) as IAccessToken;
  }

  private getRefreshToken(): Promise<IAccessToken> {
    if (this.authenticationApi)
      return this.authenticationApi.getRefreshToken();
    else
      return this.loadToken();
  }
}
