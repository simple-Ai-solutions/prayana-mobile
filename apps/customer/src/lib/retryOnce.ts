// A home section's data call with one quiet second try. On a phone the first
// request often dies to a flaky connection; without this the section just
// hid itself until the next app launch.
export function retryOnce<T>(call: () => Promise<T>, waitMs = 1500): Promise<T> {
  return call().catch(
    () => new Promise<T>((resolve, reject) => setTimeout(() => call().then(resolve, reject), waitMs)),
  );
}
