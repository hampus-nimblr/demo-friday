/**
 * Shared by the start screen and the score route on purpose.
 *
 * If the two sides validated separately they would eventually disagree, and the
 * failure is a quiet one: the button enables, the player finishes a run, the
 * POST 400s, and the score vanishes with nothing on screen to explain it. One
 * predicate means the client can never offer a start the server will reject.
 *
 * Deliberately permissive — one @, something either side, a dot in the domain,
 * no whitespace. The address is a contact detail, not a credential: nothing
 * authenticates with it and no mail is sent at submit time, so a typo costs a
 * dead row in the export, while strictness costs a real pilot at the door.
 *
 * Tightening this to corporate domains only (rejecting gmail and friends) is a
 * product decision rather than a validation one, and this is where it goes.
 */
export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
