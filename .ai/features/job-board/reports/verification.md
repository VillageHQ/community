# Independent verification (a separate agent that did not write the code)

Round 1, on a throwaway database with made-up people and a local fake feed server:
- Each of the 12 sample feeds parses into 3 jobs: PASS.
- A linked Greenhouse sample shows on the members' board and in the widget frame (cross-origin page, frame sized itself): PASS.
- Module off: every jobs API, the public board, the frame and the scripts answer 404; member pages show the not-found page: PASS, with one note. Signed in, the not-found page comes with status 200, because the app's shared loading screen streams the page. This is a platform behaviour that `/members/<unknown id>` shares, not this module.
- Public board off: visitors get 404 on the public board and the frame: PASS.
- A broken feed (500) shows "Lever answered with an error (500). We try again next hour." and keeps the old jobs: PASS.
- Tried to break it, and these held: other members and the admin limits, SSRF through pasted links and redirects, XSS through titles and links, member names on the public board and frame, cookies on the frame, framing headers.
- Defects found: a founder could undo an admin's Hide; the careers link was saved as typed. Both were fixed.

Round 2, re-checking only the fixes: an admin's Hide sticks, and the founder sees "Hidden by an admin" with no Show button. The careers link is saved as a clean https:// address, without login details. Both PASS; module tests 60/60.

Known and not fixed: a different capitalisation of the frame's path (`/API/job-board/embed`) also gets `frame-ancestors *`. It only ever serves the app's 404 page.
