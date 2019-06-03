import * as fs from "fs";

export class Fs {

  public static readTextFile(filename: string, options: { encoding: string; flag?: string; }): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readFile(filename, options, (err, data) => {
        if (err)
          reject(err);
        else
          resolve(data);
      });
    });
  }

  public static writeFile(filename: string, data: any, options?: {encoding?: string; mode?: string; flag?: string; }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(filename, data, options, err => {
        if (err)
          reject(err);
        else
          resolve(null);
      });
    });
  }
}
