# Real HTTP against next dev (throwaway data)
## older forwarded link and newer link both open:
Yes, introduce us
Yes, introduce us
## first tap on the older link (yes):
{"answer":"yes","isRepeat":false}
## second tap, same link (no thanks):
{"answer":"yes","isRepeat":true}
## the newer link after the older one was used:
{"answer":"yes","isRepeat":true}
## 12 more taps on a used link (status codes, no rate limit):
200 200 200 200 200 200 200 200 200 200 200 200 
## an unknown token:
{"code":"intro_consent_link_closed","message":"This link isn't open any more. There's nothing you need to do."}
