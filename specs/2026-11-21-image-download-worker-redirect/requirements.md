# Staging image imports on Cloudflare Workers

- Fetch provider images using the redirect mode supported by the Workers runtime.
- Reject redirect responses without fetching their destination. Continue requiring an allowlisted HTTPS source and validating returned image data.
- Verify the downloader and import tests, then import an allowlisted provider image from the staging staff gallery.
