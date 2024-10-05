import { Request, Response } from 'express';
import { getReasonPhrase } from 'http-status-codes';
// import { PATH_BASE } from "../util/environment";

/**
 * Home Page
 * @route GET /
 */
export const index = (req: Request, res: Response) => {
  return res.status(200).json({ statusCode: 200, message: getReasonPhrase(200), error: false });
  // res.render('home', {
  //   title: 'Home',
  //   pathBase: PATH_BASE
  // });
};
