import 'express';


// **** Declaration Merging **** //

declare module 'express' {

  export interface Request {
    signedCookies: Record<string, string>;
  }

  export interface ExtendedRequest extends Request {
    user?: any
  }
}
