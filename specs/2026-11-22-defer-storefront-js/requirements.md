# Defer optional storefront JavaScript

- Keep the existing assistant and rewards launch controls, load each panel when first opened, and preserve focus and consent behaviour.
- Omit product quick view from the landing route, which has no product quick-view trigger. Retain quick view on catalogue and search routes.
- Return Aheed staging to standard script priority so it can be compared with the previous control.
- Check the deferred controls, guest checkout, and browser load on staging.
