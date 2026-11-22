# Aheed staging homepage script priority trial

- Lower the fetch priority of first-party Next.js startup JavaScript on the Aheed staging homepage HTML response. Preserve script execution and leave CSS priority intact.
- Use an explicit request header to compare control and treatment on the same commit. Scope the wrapper to Aheed staging deployment and leave non-homepage and RSC responses intact.
- Check canonical response freshness, mobile LCP, layout, search and guest basket behaviour.
