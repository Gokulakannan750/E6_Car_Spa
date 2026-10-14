# Unresolved release settings

14 October 2026. These are not evidence of configured production behaviour.

| Setting / decision | Current evidence | Required confirmation |
|---|---|---|
| Production API and catalogue | No verified production endpoint supplied in this task | Read public catalogue on intended production API and record timestamp, plan/module availability and trial settings |
| Trial wording | Seed/configuration code supports trial settings; seed values are not production proof | Confirm eligibility, availability, duration and included plan; retain neutral Sign up wording until then |
| Signup host | Plan defers domain decision | Confirm host before publishing signup/pricing links |
| VITE_PRODUCT_URL | Phase 4 task | Configure return link to verified product page |
| Payment | SIGNUP_API.md describes test-only payment; real gateway is separate work | Confirm production payment mode or contact fallback; staging-only test payments |
| Downloads | No verified public installer/store destination supplied | Use documented contact fallback until links are approved |
| Policy links | Plan records policy publication/review outstanding | Confirm final Terms, Refund and Privacy pages before release |
| Copy and screenshots | Final copy and all four screenshots approved by the user, 14 October 2026 | Complete; preserve approved assets and claims |
| E6 endorsement | User says omit for now | Keep omitted unless later explicitly authorised |

Production settings must not be inferred from local test data, seeded plans, or a successful local preview. No company creation or payment tests are authorised against production customer data.

## Local catalogue observation

Read-only GET http://localhost:5192/api/public/catalog on 14 October 2026. Snapshot: local-catalog.json. Trial days: 7; trial licences: 3; testPayments: true. Starter modules: none. Professional modules: audit trail, outside jobs, advanced reports, staff advances and WhatsApp. Add-on labels match the seed table. This is local test evidence, not intended production confirmation. No production endpoint has been supplied.




