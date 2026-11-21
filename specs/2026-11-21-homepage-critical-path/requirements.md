# Storefront homepage critical path

- Keep the current storefront design, navigation, vendor pricing, and customer and staff session behaviour.
- Share the storefront chrome, header and cart session read within a render and run independent storefront reads concurrently.
- Let the storefront render while the optional rewards launcher resolves. Preserve its vendor-level visibility and existing referral behaviour.
- Exclude documentation and test sources from Tailwind utility generation. Keep runtime sources and verify representative storefront and staff styling.
- Verify the focused header, cart, rewards and landing tests. Compare staging mobile LCP on both stores with fresh browser contexts and the same network and CPU settings.
