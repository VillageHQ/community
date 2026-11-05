import { configure } from "@testing-library/dom";

const ASYNC_TIMEOUT_MS = 10_000;

// A deadline only slows a test that is already failing, so these can be generous. The defaults of one second fail on a loaded machine.
export const EVENTUALLY = { timeout: ASYNC_TIMEOUT_MS };

configure({ asyncUtilTimeout: ASYNC_TIMEOUT_MS });
