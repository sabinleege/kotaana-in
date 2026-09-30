# Track Me background / locked-screen behavior

## What is implemented

Track Me now:

- stores the active route locally in IndexedDB, with a localStorage fallback;
- stores every accepted GPS point while the session is active;
- calculates elapsed time from timestamps rather than a JavaScript timer, so timer throttling does not reset the session;
- restores an unfinished session after a page reload;
- recreates the browser GPS watcher when the page returns from the background/lock state;
- keeps trying through transient GPS timeout/unavailable errors;
- rejects very poor GPS fixes and implausible segment speeds;
- preserves run/walk/ride as the activity type when saving;
- keeps the local draft when the server save fails, so a temporary network outage does not destroy the route.

## Important Android limitation

A web browser cannot guarantee continuous GPS collection while the phone is locked or while the browser has been suspended. A phone that is **physically powered off** cannot collect GPS points at all because the operating system and GPS receiver are not running.

For production Android locked-screen/background tracking, the installed native Android build must use a foreground location service. The project should use a maintained Capacitor background-geolocation implementation, request the required location permission, show the required persistent Android tracking notification, and collect points natively before sending them to `/api/track/run` when the session ends or during a controlled sync.

The community Capacitor background-geolocation plugin documents Android/iOS background updates, an Android foreground notification, and Android-specific permission requirements. See the official project documentation before shipping the native wrapper:

https://github.com/capacitor-community/background-geolocation

## User-facing behavior

Kotaana must describe the feature accurately:

- **Screen locked/background:** supported by the native Android build; browser version is best-effort and resumes/reacquires GPS when the browser returns.
- **Phone physically powered off:** impossible to track distance during the powered-off interval.
- **Network temporarily unavailable:** the active route remains locally stored until it can be saved.

- GPS acquisition/watch errors now use a 3-second timeout so Kotaana retries more frequently when a fix is not obtained.
