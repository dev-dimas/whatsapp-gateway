/* eslint-disable no-useless-escape */
'use strict';

import { Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import { PATH_BASE } from '../util/environment';

/**
 * Get Message Form
 * @route GET /message
 */
export const getMessageForm = (req: Request, res: Response) => {
  return res.render('message', {
    title: 'Send Message',
    pathBase: PATH_BASE,
  });
};

/**
 * Send Message
 * @route POST /message
 */
export const postMessage = async (req: Request, res: Response) => {
  await body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number cannot be blank!')
    .matches('^[0-9+ -]+$')
    .withMessage('Invalid phone number format!')
    .trim()
    .run(req);

  await body('message').notEmpty().withMessage('Message cannot be blank!').trim().run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      StatusCode: StatusCodes.BAD_REQUEST,
      message: ReasonPhrases.BAD_REQUEST,
      errors: errors.array(),
    });
  }

  const phoneNumber = req.body.phoneNumber;
  const message = req.body.message;

  req.wa!.SendWhatsappSimpleMessage(phoneNumber, message);

  return res.status(StatusCodes.OK).json({
    statusCode: StatusCodes.OK,
    message: ReasonPhrases.OK,
    errors: null,
  });
};
