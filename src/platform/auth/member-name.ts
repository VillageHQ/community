import { z } from "zod";

import { removeBidiControls, removeNullBytes } from "../text/safe-text.ts";

export const MAXIMUM_NAME_LENGTH = 80;

export const nameSchema = z
  .string()
  .overwrite(removeNullBytes)
  .overwrite(removeBidiControls)
  .trim()
  .min(1, "Enter your name.")
  .max(MAXIMUM_NAME_LENGTH, `Keep your name under ${MAXIMUM_NAME_LENGTH} characters.`);
