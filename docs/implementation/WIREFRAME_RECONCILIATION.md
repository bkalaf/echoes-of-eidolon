# Base v11.3 and V3 Wireframe Registry Reconciliation

## Result

- Status: PASS
- Active v11.3 source rows: 269
- Application registry rows: 269
- V3 excluded base rows: 3
- V3 amendment rows: 7
- Active mechanically derived rows: 273
- Exact canonical row matches: 269
- Missing application rows: 0
- Extra application rows: 0
- Mismatched application rows: 0
- Governed desktop source PNGs matched: 269
- Missing governed source PNGs: 0
- Supplemental correction/reference PNGs outside the active manifest: 3
- Explicit mobile/responsive source variants: 0. Responsive layout remains a derived implementation requirement for every active row.
- Source manifest SHA-256: `0106a543a71946c44bf831f3be8fe8f20f15916ee99054d2f1b5964eb2ddd5d4`
- Application manifest SHA-256: `0106a543a71946c44bf831f3be8fe8f20f15916ee99054d2f1b5964eb2ddd5d4`
- V3 amendment manifest SHA-256: `4dbf9bda3bbffba2d2c7ced4d02497a10473f28736982bb9c7db03a7a7dcbd56`

Duplicate screen IDs and paths below are governed state variants. Review order is the unique row identity.

- Repeated screen IDs: 5
- Repeated route/modal-owner values: 21

## Active registry

| Review | Page | Screen/state ID | Title | Route or modal owner | Source |
|---:|---:|---|---|---|---|
| 1 | 1 | PUB001 | Home | / | REBUILT_V11 |
| 2 | 2 | PUB_HOME_ADMIN | Home | / | REBUILT_V11_1_OWNER_REVIEW |
| 3 | 3 | PUB_HOME_MEMBER | Home | / | REBUILT_V11_1_OWNER_REVIEW |
| 4 | 4 | PUB002 | Features | /features | REBUILT_V11_1_OWNER_REVIEW |
| 5 | 5 | FEATURE_01 | A Living World | /features/a-living-world | REBUILT_V11_1_OWNER_REVIEW |
| 6 | 6 | FEATURE_02 | Forge Your Path | /features/forge-your-path | REBUILT_V11_1_OWNER_REVIEW |
| 7 | 7 | FEATURE_03 | Real Challenges | /features/real-challenges | REBUILT_V11_1_OWNER_REVIEW |
| 8 | 8 | FEATURE_04 | Leave Your Mark | /features/leave-your-mark | REBUILT_V11_1_OWNER_REVIEW |
| 9 | 9 | FEATURE_05 | The Power of Three | /features/the-power-of-three | REBUILT_V11_1_OWNER_REVIEW |
| 10 | 10 | FEATURE_06 | Truth Still Matters | /features/truth-still-matters | REBUILT_V11_1_OWNER_REVIEW |
| 11 | 11 | FEATURE_08 | Speak or Type Freely | /features/speak-or-type-freely | REBUILT_V11_1_OWNER_REVIEW |
| 12 | 12 | FEATURE_09 | A Unique and Powerful Story | /features/a-unique-and-powerful-story | REBUILT_V11_1_OWNER_REVIEW |
| 13 | 13 | FEATURE_07 | Real Life Comes First | /features/real-life-comes-first | REBUILT_V11_1_OWNER_REVIEW |
| 14 | 14 | PUB003 | Gameplay | /gameplay | REBUILT_V11_1_OWNER_REVIEW |
| 15 | 15 | PUB017 | Release Notes | /status/releases | REBUILT_V11_1_OWNER_REVIEW |
| 16 | 16 | PUB018 | Release Note Detail | /status/releases/:version | REBUILT_V11_1_OWNER_REVIEW |
| 17 | 18 | PUB015 | Contact Us | /contact | REBUILT_V11_1_OWNER_REVIEW |
| 18 | 19 | PUB016 | Game & Server Status | /status | REBUILT_V11_1_OWNER_REVIEW |
| 19 | 21 | PUB009 | Donation Checkout | /donate/checkout | REBUILT_V11 |
| 20 | 22 | PUB019 | Legal Index | /legal | OWNER_SUPPLIED_LOCKED_PNG |
| 21 | 23 | LEGAL01 | Legal Document - Terms | /legal/terms | OWNER_SUPPLIED_LOCKED_PNG |
| 22 | 24 | LEGAL02 | Legal Document - Privacy | /legal/privacy | OWNER_SUPPLIED_LOCKED_PNG |
| 23 | 25 | LEGAL03 | Legal Document - Cookies | /legal/cookies | OWNER_SUPPLIED_LOCKED_PNG |
| 24 | 26 | LEGAL04 | Legal Document - Accessibility | /legal/accessibility | OWNER_SUPPLIED_LOCKED_PNG |
| 25 | 27 | LEGAL05 | Legal Document - Conduct | /legal/conduct | OWNER_SUPPLIED_LOCKED_PNG |
| 26 | 28 | LEGAL06 | Legal Document - Beta | /legal/beta | OWNER_SUPPLIED_LOCKED_PNG |
| 27 | 29 | LEGAL07 | Legal Document - Membership | /legal/membership | OWNER_SUPPLIED_LOCKED_PNG |
| 28 | 30 | LEGAL08 | Legal Document - Donations | /legal/donations | OWNER_SUPPLIED_LOCKED_PNG |
| 29 | 31 | LEGAL09 | Legal Document - Store | /legal/store | OWNER_SUPPLIED_LOCKED_PNG |
| 30 | 32 | LEGAL10 | Legal Document - Shipping | /legal/shipping | OWNER_SUPPLIED_LOCKED_PNG |
| 31 | 33 | LEGAL11 | Legal Document - Returns | /legal/returns | OWNER_SUPPLIED_LOCKED_PNG |
| 32 | 34 | LEGAL12 | Legal Document - Ip Fan Content | /legal/ip-fan-content | OWNER_SUPPLIED_LOCKED_PNG |
| 33 | 35 | LEGAL13 | Legal Document - Ai Player Content | /legal/ai-player-content | OWNER_SUPPLIED_LOCKED_PNG |
| 34 | 36 | LEGAL14 | Legal Document - Cultural Use & Research Corrections | /legal/cultural-use-research-corrections | OWNER_SUPPLIED_LOCKED_PNG |
| 35 | 37 | PUB020 | Donate - Guest / Information Only | /donate | OWNER_SUPPLIED_LOCKED_PNG |
| 36 | 38 | PUB021 | Donate - Eligible Participant | /donate | OWNER_SUPPLIED_LOCKED_PNG |
| 37 | 39 | AUT008 | Session Expired | /auth/session-expired | REBUILT_V11 |
| 38 | 40 | PUB023 | Request an Invite - Public Entry | /request-invite | OWNER_SUPPLIED_LOCKED_PNG |
| 39 | 41 | AUTH01 | Sign In | /auth/sign-in | OWNER_SUPPLIED_LOCKED_PNG |
| 40 | 42 | AUTH02 | Sign Out | /auth/sign-out | OWNER_SUPPLIED_LOCKED_PNG |
| 41 | 43 | AUTH03 | Sign Up | /auth/sign-up | OWNER_SUPPLIED_LOCKED_PNG |
| 42 | 44 | AUTH04 | Forgot Password | /auth/forgot-password | OWNER_SUPPLIED_LOCKED_PNG |
| 43 | 45 | AUTH05 | Reset Password | /auth/reset-password | OWNER_SUPPLIED_LOCKED_PNG |
| 44 | 46 | AUTH06 | Verify Email - Modal | Modal in /auth/sign-up | REBUILT_V11_OWNER_CORRECTION |
| 45 | 47 | AUTH07 | Redeem Invitation | /auth/redeem-invitation | OWNER_SUPPLIED_LOCKED_PNG |
| 46 | 48 | AUTH08 | Two-Factor Challenge | /auth/two-factor | OWNER_SUPPLIED_LOCKED_PNG |
| 47 | 49 | AUTH09 | Passkeys | /auth/passkeys | OWNER_SUPPLIED_LOCKED_PNG |
| 48 | 50 | ACC001 | Account - Profile | /account/profile | OWNER_SUPPLIED_LOCKED_PNG |
| 49 | 51 | ACC002 | Change Email - Modal | Modal in /account/profile | REBUILT_V11_OWNER_CORRECTION |
| 50 | 52 | ACC003 | Change Email - Verify Modal | Modal in /account/profile | REBUILT_V11_OWNER_CORRECTION |
| 51 | 53 | ACC004 | Authorized Sessions | /account/profile | OWNER_SUPPLIED_LOCKED_PNG |
| 52 | 54 | ACC005 | Subscription - Not Subscribed | /account/subscription | OWNER_SUPPLIED_LOCKED_PNG |
| 53 | 55 | ACC006 | Subscription - Payment Accepted | /account/subscription | OWNER_SUPPLIED_LOCKED_PNG |
| 54 | 56 | ACC007 | Subscription - Card Declined | /account/subscription | OWNER_SUPPLIED_LOCKED_PNG |
| 55 | 57 | ACC008 | Subscription - Active | /account/subscription | OWNER_SUPPLIED_LOCKED_PNG |
| 56 | 58 | ACC009 | Subscription - Cancel Confirmation | /account/subscription | OWNER_SUPPLIED_LOCKED_PNG |
| 57 | 59 | ACC010 | Subscription - History | /account/subscription | OWNER_SUPPLIED_LOCKED_PNG |
| 58 | 60 | ACC011 | Orders | /account/orders | OWNER_SUPPLIED_LOCKED_PNG |
| 59 | 61 | ACC012 | Order Detail | /account/orders/:orderid | OWNER_SUPPLIED_LOCKED_PNG |
| 60 | 62 | ACC013 | Return Request | /account/orders/:orderid/return | OWNER_SUPPLIED_LOCKED_PNG |
| 61 | 63 | ACC014 | Settings - Standalone | /settings | OWNER_SUPPLIED_LOCKED_PNG |
| 62 | 64 | ACC015 | Settings - Account Tab Mirror | /account/settings | OWNER_SUPPLIED_LOCKED_PNG |
| 63 | 65 | ACC016 | Progress | /account/progress | OWNER_SUPPLIED_LOCKED_PNG |
| 64 | 66 | ACC017 | Progress - No Current Countdown | /account/progress | OWNER_SUPPLIED_LOCKED_PNG |
| 65 | 67 | ACC018 | Achievements | /account/achievements | OWNER_SUPPLIED_LOCKED_PNG |
| 66 | 68 | ACC019 | Help Tickets | /account/support | OWNER_SUPPLIED_LOCKED_PNG |
| 67 | 69 | ACC020 | Create Help Ticket | /account/support/new | OWNER_SUPPLIED_LOCKED_PNG |
| 68 | 70 | ACC021 | Help Ticket Detail | /account/support/:ticketid | OWNER_SUPPLIED_LOCKED_PNG |
| 69 | 71 | ACC022 | Request Invite | /account/invitations/request | OWNER_SUPPLIED_LOCKED_PNG |
| 70 | 72 | ACC023 | Invite Request - Pending | /account/invitations/request | OWNER_SUPPLIED_LOCKED_PNG |
| 71 | 73 | ACC030 | Authenticated Beta Landing | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 72 | 74 | STORE01 | Store Landing | /store | OWNER_SUPPLIED_LOCKED_PNG |
| 73 | 75 | STORE02 | Store Category - Posters | /store/categories/posters | OWNER_SUPPLIED_LOCKED_PNG |
| 74 | 76 | STORE03 | Store Category - Mugs | /store/categories/mugs | OWNER_SUPPLIED_LOCKED_PNG |
| 75 | 77 | STORE04 | Store Category - Hoodies | /store/categories/hoodies | OWNER_SUPPLIED_LOCKED_PNG |
| 76 | 78 | STORE05 | Product Detail | /store/products/:slug | OWNER_SUPPLIED_LOCKED_PNG |
| 77 | 79 | STORE06 | Cart | /store/cart | OWNER_SUPPLIED_LOCKED_PNG |
| 78 | 80 | STORE07 | Checkout - Contact & Delivery | /store/checkout | OWNER_SUPPLIED_LOCKED_PNG |
| 79 | 81 | ADM002 | Server Operations | /admin/server | REBUILT_V11 |
| 80 | 82 | STORE09 | Checkout - Card Declined | /store/checkout/declined | OWNER_SUPPLIED_LOCKED_PNG |
| 81 | 83 | STORE10 | Checkout - Approved | /store/checkout/approved | OWNER_SUPPLIED_LOCKED_PNG |
| 82 | 84 | STORE11 | Guest Order Status | /store/orders/:token | OWNER_SUPPLIED_LOCKED_PNG |
| 83 | 85 | STORE12 | Guest Order Lookup | /store/order-lookup | OWNER_SUPPLIED_LOCKED_PNG |
| 84 | 86 | STORE13 | Store Order Support | /store/support | OWNER_SUPPLIED_LOCKED_PNG |
| 85 | 87 | ADM001 | Admin Dashboard | /admin | OWNER_SUPPLIED_LOCKED_PNG |
| 86 | 88 | ADM002 | Accounts | /admin/access | OWNER_SUPPLIED_LOCKED_PNG |
| 87 | 89 | ADM003 | Roles | /admin/access/roles | OWNER_SUPPLIED_LOCKED_PNG |
| 88 | 90 | ADM004 | Invite/Access Approval Queue | /admin/access/approvals | OWNER_SUPPLIED_LOCKED_PNG |
| 89 | 91 | ADM005 | Account Detail | /admin/access/:id | OWNER_SUPPLIED_LOCKED_PNG |
| 90 | 92 | ADM006 | Invitation Codes | /admin/access/invites | OWNER_SUPPLIED_LOCKED_PNG |
| 91 | 93 | ADM007 | Donation Perks | /admin/perks | OWNER_SUPPLIED_LOCKED_PNG |
| 92 | 94 | ADM008 | Perk Detail/Edit | /admin/perks/:id | OWNER_SUPPLIED_LOCKED_PNG |
| 93 | 95 | ADM010 | Store Management | /admin/store | OWNER_SUPPLIED_LOCKED_PNG |
| 94 | 96 | ADM011 | Store Categories | /admin/store/categories | OWNER_SUPPLIED_LOCKED_PNG |
| 95 | 97 | ADM012 | Store Items | /admin/store/items | OWNER_SUPPLIED_LOCKED_PNG |
| 96 | 98 | ADM013 | Store Item Editor | /admin/store/items/:id | OWNER_SUPPLIED_LOCKED_PNG |
| 97 | 99 | ADM014 | Order Management | /admin/orders | OWNER_SUPPLIED_LOCKED_PNG |
| 98 | 100 | ADM015 | Order Management - Merchandise | /admin/orders?tab=merchandise | OWNER_SUPPLIED_LOCKED_PNG |
| 99 | 101 | ADM016 | Order Management - Subscriptions | /admin/orders?tab=subscriptions | OWNER_SUPPLIED_LOCKED_PNG |
| 100 | 102 | ADM017 | Order Management - Donations | /admin/orders?tab=donations | OWNER_SUPPLIED_LOCKED_PNG |
| 101 | 103 | ADM018 | Order Detail/Admin Actions | /admin/orders/:id | OWNER_SUPPLIED_LOCKED_PNG |
| 102 | 104 | ADM020 | Bulk Operations & External API | /admin/data/bulk-operations | OWNER_SUPPLIED_LOCKED_PNG |
| 103 | 105 | ADM021 | Bulk API - Enabled Key | /admin/data/bulk-operations | OWNER_SUPPLIED_LOCKED_PNG |
| 104 | 106 | ADM022 | Bulk Operations - Audit / Recent Activity | /admin/data/bulk-operations | OWNER_SUPPLIED_LOCKED_PNG |
| 105 | 107 | DATA_ANTAGONIST_TABLE | Antagonist Records | /admin/data/antagonist | REBUILT_V11 |
| 106 | 108 | ADM031 | Asset Manager - Audio | /admin/assets/audio | OWNER_SUPPLIED_LOCKED_PNG |
| 107 | 109 | ADM032 | Asset Manager - Video | /admin/assets/video | OWNER_SUPPLIED_LOCKED_PNG |
| 108 | 110 | ADM033 | Prompt Manager | /admin/prompts | OWNER_SUPPLIED_LOCKED_PNG |
| 109 | 111 | ADM034 | Prompt Manager - Outstanding Only | /admin/prompts | OWNER_SUPPLIED_LOCKED_PNG |
| 110 | 112 | DATA000 | Data - Object Types | /admin/data | OWNER_SUPPLIED_LOCKED_PNG |
| 111 | 113 | DATA001 | Data - Protagonist | /admin/data/protagonist | REBUILT_V11_2_OWNER_REVIEW |
| 112 | 114 | DATA002 | Data - Culture | /admin/data/culture | OWNER_SUPPLIED_LOCKED_PNG |
| 113 | 115 | DATA003 | Data - Character | /admin/data/character | OWNER_SUPPLIED_LOCKED_PNG |
| 114 | 116 | DATA004 | Data - Witness | /admin/data/witness | OWNER_SUPPLIED_LOCKED_PNG |
| 115 | 117 | DATA005 | Data - Architect | /admin/data/architect | OWNER_SUPPLIED_LOCKED_PNG |
| 116 | 118 | DATA006 | Data - Antagonist | /admin/data/antagonist | OWNER_SUPPLIED_LOCKED_PNG |
| 117 | 119 | DATA007 | Data - Species | /admin/data/species | OWNER_SUPPLIED_LOCKED_PNG |
| 118 | 120 | DATA008 | Data - PersonalityExpression | /admin/data/personality-expression | OWNER_SUPPLIED_LOCKED_PNG |
| 119 | 121 | DATA009 | Data - TimelineEvent | /admin/data/timeline-event | OWNER_SUPPLIED_LOCKED_PNG |
| 120 | 122 | DATA010 | Data - Interlude | /admin/data/interlude | OWNER_SUPPLIED_LOCKED_PNG |
| 121 | 123 | DATA011 | Data - Pillar | /admin/data/pillar | OWNER_SUPPLIED_LOCKED_PNG |
| 122 | 124 | DATA012 | Data - Ark | /admin/data/ark | OWNER_SUPPLIED_LOCKED_PNG |
| 123 | 125 | DATA013 | Data - Constellation | /admin/data/constellation | OWNER_SUPPLIED_LOCKED_PNG |
| 124 | 126 | DATA014 | Data - Reward | /admin/data/reward | OWNER_SUPPLIED_LOCKED_PNG |
| 125 | 127 | DATA015 | Data - Soul | /admin/data/soul | OWNER_SUPPLIED_LOCKED_PNG |
| 126 | 128 | DATA016 | Data - PointOfInterest | /admin/data/point-of-interest | OWNER_SUPPLIED_LOCKED_PNG |
| 127 | 129 | DATA017 | Data - Site | /admin/data/site | OWNER_SUPPLIED_LOCKED_PNG |
| 128 | 130 | DATA018 | Data - Settlement | /admin/data/settlement | OWNER_SUPPLIED_LOCKED_PNG |
| 129 | 131 | DATA019 | Data - Breed | /admin/data/breed | OWNER_SUPPLIED_LOCKED_PNG |
| 130 | 132 | DATA020 | Data - Tome | /admin/data/tome | OWNER_SUPPLIED_LOCKED_PNG |
| 131 | 133 | DATA021 | Data - Lesson | /admin/data/lesson | OWNER_SUPPLIED_LOCKED_PNG |
| 132 | 134 | DATA022 | Data - Companion | /admin/data/companion | OWNER_SUPPLIED_LOCKED_PNG |
| 133 | 135 | DATA100 | Data - Research | /admin/data/research | OWNER_SUPPLIED_LOCKED_PNG |
| 134 | 136 | DATA101 | Data - MLA Sources | /admin/data/sources | OWNER_SUPPLIED_LOCKED_PNG |
| 135 | 137 | DATA102 | Data - Citations | /admin/data/citations | OWNER_SUPPLIED_LOCKED_PNG |
| 136 | 138 | PZ001 | Puzzle Designer - Blueprints | /admin/puzzles | OWNER_SUPPLIED_LOCKED_PNG |
| 137 | 139 | PZ002 | Puzzle Blueprint Editor | /admin/puzzles/:id | OWNER_SUPPLIED_LOCKED_PNG |
| 138 | 140 | PZ003 | Puzzle Test/Preview | /admin/puzzles/:id/test | OWNER_SUPPLIED_LOCKED_PNG |
| 139 | 141 | DATA_ANTAGONIST_NEW | Create Antagonist | /admin/data/antagonist/new | REBUILT_V11_2_OWNER_REVIEW |
| 140 | 142 | AT002 | Points of Interest - 2D Map | /admin/atlas/poi | OWNER_SUPPLIED_LOCKED_PNG |
| 141 | 143 | AT003 | Points of Interest - 3D Globe | /admin/atlas/poi | OWNER_SUPPLIED_LOCKED_PNG |
| 142 | 144 | AT004 | Sites | /admin/atlas/sites | OWNER_SUPPLIED_LOCKED_PNG |
| 143 | 145 | AT005 | Settlements | /admin/atlas/settlements | REBUILT_V11_2_OWNER_REVIEW |
| 144 | 146 | DATA_CHARACTER_NEW | Create Character | /admin/data/character/new | REBUILT_V11 |
| 145 | 147 | CITY01 | City Builder - Cities | /admin/cities | OWNER_SUPPLIED_LOCKED_PNG |
| 146 | 148 | CITY02 | City Builder - Parcels & Street Graph | /admin/cities/:id/streets | OWNER_SUPPLIED_LOCKED_PNG |
| 147 | 149 | CITY03 | City Builder - Buildings & Exteriors | /admin/cities/:id/exteriors | REBUILT_V11_2_OWNER_REVIEW |
| 148 | 150 | CITY04 | City Builder - Interiors | /admin/cities/:id/interiors | REBUILT_V11_2_OWNER_REVIEW |
| 149 | 151 | CITY05 | City Builder - Preview / District Overlays | /admin/cities/:id/preview | OWNER_SUPPLIED_LOCKED_PNG |
| 150 | 152 | CAM001 | Campaign Builder - Landing | /admin/campaign | OWNER_SUPPLIED_LOCKED_PNG |
| 151 | 153 | CAM002 | Campaign Planner | /admin/campaign/planner | REBUILT_V11_2_OWNER_REVIEW |
| 152 | 154 | CAM003 | Campaign Planner - Witness Drop | /admin/campaign/planner | OWNER_SUPPLIED_LOCKED_PNG |
| 153 | 155 | CAM004 | Campaign Planner - Invalid Architect Drop | /admin/campaign/planner | OWNER_SUPPLIED_LOCKED_PNG |
| 154 | 156 | CAM005 | Campaign Planner - Reward Binding | /admin/campaign/planner | OWNER_SUPPLIED_LOCKED_PNG |
| 155 | 157 | OPS001 | Operations | /admin/operations | OWNER_SUPPLIED_LOCKED_PNG |
| 156 | 158 | OPS002 | Release Management | /admin/operations/releases | OWNER_SUPPLIED_LOCKED_PNG |
| 157 | 159 | DATA023 | Data - SpeciesGroup | /admin/data/species-group | OWNER_SUPPLIED_LOCKED_PNG |
| 158 | 160 | DATA024 | Data - InterludeSubstitution | /admin/data/interlude-substitution | OWNER_SUPPLIED_LOCKED_PNG |
| 159 | 161 | DATA025 | Data - Definition | /admin/data/definition | OWNER_SUPPLIED_LOCKED_PNG |
| 160 | 162 | DATA026 | Data - KnowledgeBaseItem | /admin/data/knowledge-base-item | OWNER_SUPPLIED_LOCKED_PNG |
| 162 | 164 | DATA028 | Data - Layette | /admin/data/layette | OWNER_SUPPLIED_LOCKED_PNG |
| 163 | 165 | DATA029 | Data - Transition | /admin/data/transition | OWNER_SUPPLIED_LOCKED_PNG |
| 164 | 166 | DATA030 | Data - CapabilityDefinition | /admin/data/capability-definition | OWNER_SUPPLIED_LOCKED_PNG |
| 165 | 167 | DATA031 | Data - AchievementDefinition | /admin/data/achievement-definition | OWNER_SUPPLIED_LOCKED_PNG |
| 166 | 168 | GAME001 | Game - Effective Viewport | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 167 | 169 | GAME002 | Knowledge Base - Graph | /game/knowledge | OWNER_SUPPLIED_LOCKED_PNG |
| 168 | 170 | GAME003 | Knowledge Base - Detail Card | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 169 | 171 | GAME004 | Bookshelf / Tome Reader | state-only | REBUILT_V11_2_OWNER_REVIEW |
| 170 | 172 | GAME005 | Maps - 3D Globe | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 171 | 173 | GAME006 | Continent Map | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 172 | 174 | GAME007 | City Map | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 173 | 175 | GAME008 | Game - Nearby Characters | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 174 | 176 | GAME009 | Game - Multiple Exits | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 175 | 177 | GAME010 | Game - Single Exit | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 176 | 178 | GAME011 | Witness Trial Warning | /game/witness-trial | OWNER_SUPPLIED_LOCKED_PNG |
| 177 | 179 | GAME012 | Companions | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 178 | 180 | GAME013 | Constellations / Sky Viewer | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 179 | 181 | GAME014 | Calendar | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 180 | 182 | GAME015 | Shared Settings - Game Overlay | Modal in /game | REBUILT_V11_OWNER_CORRECTION |
| 181 | 183 | GAME016 | Knowledge Base - Timeline Viewer | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 182 | 184 | TOOL001 | Control Gallery - Hardened Lookups | /review/controls/lookups | OWNER_SUPPLIED_LOCKED_PNG |
| 183 | 185 | TOOL002 | Control Gallery - Free Solo | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 184 | 186 | TOOL003 | Control Gallery - Enum Selects | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 185 | 187 | TOOL004 | Control Gallery - Numeric | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 186 | 188 | TOOL005 | Wireframe Builder - Component Composer | state-only | OWNER_SUPPLIED_LOCKED_PNG |
| 187 | 189 | TOOL006 | Public Navigation - Guest/User/Member States | /review/navigation-states | OWNER_SUPPLIED_LOCKED_PNG |
| 188 | 190 | DATA_LEGENDARYREWARD_EDIT | Edit LegendaryReward | /admin/data/legendaryreward/sample-record | REBUILT_V11 |
| 189 | 191 | DATA_LESSON_EDIT | Edit Lesson | /admin/data/lesson/sample-record | REBUILT_V11 |
| 191 | 193 | DATA_PERSONALITYEXPRESSION_EDIT | Edit PersonalityExpression | /admin/data/personalityexpression/sample-record | REBUILT_V11 |
| 192 | 194 | DATA_PILLAR_EDIT | Edit Pillar | /admin/data/pillar/sample-record | REBUILT_V11 |
| 193 | 195 | DATA_POINTOFINTEREST_EDIT | Edit PointOfInterest | /admin/data/pointofinterest/sample-record | REBUILT_V11 |
| 194 | 196 | DATA_PROTAGONIST_EDIT | Edit Protagonist | /admin/data/protagonist/sample-record | REBUILT_V11 |
| 195 | 197 | DATA_RESEARCH_EDIT | Edit Research | /admin/data/research/sample-record | REBUILT_V11 |
| 196 | 198 | DATA_SETTLEMENT_EDIT | Edit Settlement | /admin/data/settlement/sample-record | REBUILT_V11 |
| 197 | 199 | DATA_SITE_EDIT | Edit Site | /admin/data/site/sample-record | REBUILT_V11 |
| 198 | 200 | DATA_SOUL_EDIT | Edit Soul | /admin/data/soul/sample-record | REBUILT_V11 |
| 199 | 201 | DATA_SOURCE_EDIT | Edit Source | /admin/data/source/sample-record | REBUILT_V11 |
| 200 | 202 | DATA_SPECIESGROUP_EDIT | Edit SpeciesGroup | /admin/data/speciesgroup/sample-record | REBUILT_V11 |
| 201 | 203 | DATA_SPECIES_EDIT | Edit Species | /admin/data/species/sample-record | REBUILT_V11 |
| 202 | 204 | DATA_TIMELINEEVENT_EDIT | Edit TimelineEvent | /admin/data/timelineevent/sample-record | REBUILT_V11 |
| 203 | 205 | DATA_TOME_EDIT | Edit Tome | /admin/data/tome/sample-record | REBUILT_V11 |
| 204 | 206 | DATA_TRANSITION_EDIT | Edit Transition | /admin/data/transition/sample-record | REBUILT_V11 |
| 205 | 207 | DATA_WITNESS_EDIT | Edit Witness | /admin/data/witness/sample-record | REBUILT_V11 |
| 206 | 208 | DATA_ACHIEVEMENTDEFINITION_IMPORT | Bulk Import AchievementDefinition | /admin/data/achievementdefinition/import | REBUILT_V11 |
| 207 | 209 | DATA_ANTAGONIST_IMPORT | Bulk Import Antagonist | /admin/data/antagonist/import | REBUILT_V11 |
| 208 | 210 | DATA_ARCHITECT_IMPORT | Bulk Import Architect | /admin/data/architect/import | REBUILT_V11 |
| 209 | 211 | DATA_ARK_IMPORT | Bulk Import Ark | /admin/data/ark/import | REBUILT_V11 |
| 210 | 212 | DATA_BREED_IMPORT | Bulk Import Breed | /admin/data/breed/import | REBUILT_V11 |
| 211 | 213 | DATA_CAPABILITYDEFINITION_IMPORT | Bulk Import CapabilityDefinition | /admin/data/capabilitydefinition/import | REBUILT_V11 |
| 212 | 214 | DATA_CHARACTER_IMPORT | Bulk Import Character | /admin/data/character/import | REBUILT_V11 |
| 213 | 215 | DATA_CITATION_IMPORT | Bulk Import Citation | /admin/data/citation/import | REBUILT_V11 |
| 214 | 216 | DATA_COMPANION_IMPORT | Bulk Import Companion | /admin/data/companion/import | REBUILT_V11 |
| 215 | 217 | DATA_CONSTELLATION_IMPORT | Bulk Import Constellation | /admin/data/constellation/import | REBUILT_V11 |
| 216 | 218 | DATA_CULTURE_IMPORT | Bulk Import Culture | /admin/data/culture/import | REBUILT_V11 |
| 217 | 219 | DATA_DEFINITION_IMPORT | Bulk Import Definition | /admin/data/definition/import | REBUILT_V11 |
| 218 | 220 | DATA_INTERLUDESUBSTITUTION_IMPORT | Bulk Import InterludeSubstitution | /admin/data/interludesubstitution/import | REBUILT_V11 |
| 219 | 221 | DATA_INTERLUDE_IMPORT | Bulk Import Interlude | /admin/data/interlude/import | REBUILT_V11 |
| 220 | 222 | DATA_KNOWLEDGEBASEITEM_IMPORT | Bulk Import KnowledgeBaseItem | /admin/data/knowledgebaseitem/import | REBUILT_V11 |
| 221 | 223 | DATA_LAYETTE_IMPORT | Bulk Import Layette | /admin/data/layette/import | REBUILT_V11 |
| 222 | 224 | DATA_LEGENDARYREWARD_IMPORT | Bulk Import LegendaryReward | /admin/data/legendaryreward/import | REBUILT_V11 |
| 223 | 225 | DATA_LESSON_IMPORT | Bulk Import Lesson | /admin/data/lesson/import | REBUILT_V11 |
| 225 | 227 | DATA_PERSONALITYEXPRESSION_IMPORT | Bulk Import PersonalityExpression | /admin/data/personalityexpression/import | REBUILT_V11 |
| 226 | 228 | DATA_PILLAR_IMPORT | Bulk Import Pillar | /admin/data/pillar/import | REBUILT_V11 |
| 227 | 229 | DATA_POINTOFINTEREST_IMPORT | Bulk Import PointOfInterest | /admin/data/pointofinterest/import | REBUILT_V11 |
| 228 | 230 | DATA_PROTAGONIST_IMPORT | Bulk Import Protagonist | /admin/data/protagonist/import | REBUILT_V11 |
| 229 | 231 | DATA_RESEARCH_IMPORT | Bulk Import Research | /admin/data/research/import | REBUILT_V11 |
| 230 | 232 | DATA_SETTLEMENT_IMPORT | Bulk Import Settlement | /admin/data/settlement/import | REBUILT_V11 |
| 231 | 233 | DATA_SITE_IMPORT | Bulk Import Site | /admin/data/site/import | REBUILT_V11 |
| 232 | 234 | DATA_SOUL_IMPORT | Bulk Import Soul | /admin/data/soul/import | REBUILT_V11 |
| 233 | 235 | DATA_SOURCE_IMPORT | Bulk Import Source | /admin/data/source/import | REBUILT_V11 |
| 234 | 236 | DATA_SPECIESGROUP_IMPORT | Bulk Import SpeciesGroup | /admin/data/speciesgroup/import | REBUILT_V11 |
| 235 | 237 | DATA_SPECIES_IMPORT | Bulk Import Species | /admin/data/species/import | REBUILT_V11 |
| 236 | 238 | DATA_TIMELINEEVENT_IMPORT | Bulk Import TimelineEvent | /admin/data/timelineevent/import | REBUILT_V11 |
| 237 | 239 | DATA_TOME_IMPORT | Bulk Import Tome | /admin/data/tome/import | REBUILT_V11 |
| 238 | 240 | DATA_TRANSITION_IMPORT | Bulk Import Transition | /admin/data/transition/import | REBUILT_V11 |
| 239 | 241 | DATA_WITNESS_IMPORT | Bulk Import Witness | /admin/data/witness/import | REBUILT_V11 |
| 240 | 242 | ADM027 | Puzzle Designer | /admin/puzzles | REBUILT_V11 |
| 241 | 243 | ADM028 | Puzzle Blueprints | /admin/puzzles/blueprints | REBUILT_V11 |
| 242 | 244 | ADM029 | Reusable Puzzle Components | /admin/puzzles/components | REBUILT_V11 |
| 243 | 245 | ADM030 | Puzzle Test & Validation Lab | /admin/puzzles/test-lab | REBUILT_V11 |
| 244 | 246 | ADM031 | Atlas Manager | /admin/atlas | REBUILT_V11 |
| 245 | 247 | ADM032 | Points of Interest — View Selector | /admin/atlas/pois | REBUILT_V11 |
| 246 | 248 | ATLAS_POI_2D | Points of Interest — 2D View | /admin/atlas/pois | REBUILT_V11 |
| 247 | 249 | ATLAS_POI_3D | Points of Interest — 3D View | /admin/atlas/pois | REBUILT_V11_2_OWNER_REVIEW |
| 248 | 250 | ADM033 | Sites | /admin/atlas/sites | REBUILT_V11 |
| 249 | 251 | AT004_FOUND_CITY | Found City — SITE-0081 | /admin/atlas/sites/SITE-0081 | REBUILT_V11 |
| 250 | 252 | ADM034 | Settlements | /admin/atlas/settlements | REBUILT_V11 |
| 251 | 253 | AT005_SETTLEMENT_DETAIL | Migrate — SET-0001 | /admin/atlas/settlements/SET-0001/migrate | REBUILT_V11 |
| 252 | 254 | ADM035 | Campaign Manager | /admin/campaign | REBUILT_V11 |
| 253 | 256 | CAMPAIGN_CONCORD | Main 18-Book Planner — Concord | /admin/campaign/planner | REBUILT_V11 |
| 254 | 257 | CAMPAIGN_RUIN | Main 18-Book Planner — Ruin | /admin/campaign/planner | REBUILT_V11 |
| 255 | 258 | CAMPAIGN_SCHISM | Main 18-Book Planner — Schism | /admin/campaign/planner | REBUILT_V11 |
| 256 | 259 | ADM037 | City Builder | /admin/city-builder | REBUILT_V11 |
| 257 | 260 | TOO001 | Wireframe Builder | /tools/wireframe-builder | REBUILT_V11 |
| 258 | 261 | TOO002 | Wireframe Component Library | /tools/wireframe-builder/components | REBUILT_V11 |
| 259 | 262 | TOO003 | Wireframe Templates | /tools/wireframe-builder/templates | REBUILT_V11 |
| 260 | 263 | GAM001 | Game Viewport | /game | REBUILT_V11_2_OWNER_REVIEW |
| 261 | 264 | GAME_VIEW_FULL | Game Viewport — Full | /game | REBUILT_V11 |
| 262 | 265 | GAME_VIEW_NO_COUNTDOWN | Game Viewport — No Countdown | /game | REBUILT_V11 |
| 263 | 266 | GAME_VIEW_SINGLE_EXIT | Game Viewport — Single Exit | /game | REBUILT_V11 |
| 264 | 267 | GAM002 | Knowledge Base Graph | /game/knowledge | REBUILT_V11 |
| 265 | 268 | GAM003 | Bookshelf | /game/bookshelf | REBUILT_V11 |
| 266 | 269 | GAM004 | Maps | /game/maps | REBUILT_V11 |
| 267 | 270 | GAM005 | Player Globe | /game/maps/globe | REBUILT_V11 |
| 268 | 271 | GAME_GLOBE_PRESENT | Player Globe — Present | /game/maps/globe | REBUILT_V11_2_OWNER_REVIEW |
| 269 | 272 | GAME_GLOBE_TIMELINE | Player Globe — Timeline | /game/maps/globe | REBUILT_V11_2_OWNER_REVIEW |
| 270 | 273 | CAP01 | Capability Registry | /admin/capabilities | V3_REMEDIATION_CAPABILITY_WIREFRAMES_V1 |
| 271 | 274 | CAP02 | Capability Definition Editor | /admin/capabilities/:capabilityDefinitionId | V3_REMEDIATION_CAPABILITY_WIREFRAMES_V1 |
| 272 | 275 | CAP03 | Address and Condition Builder | /admin/capabilities/condition-builder | V3_REMEDIATION_CAPABILITY_WIREFRAMES_V1 |
| 273 | 276 | CAP04 | Evidence Scoring Policies | /admin/capabilities/scoring | V3_REMEDIATION_CAPABILITY_WIREFRAMES_V1 |
| 274 | 277 | CAP05 | Event and Projection Inspector | /admin/capabilities/inspector | V3_REMEDIATION_CAPABILITY_WIREFRAMES_V1 |
| 275 | 278 | CAM006 | Book Grouping Membership Editor | state-only | V3_REMEDIATION_CAMPAIGN_WIREFRAMES_V2 |
| 276 | 279 | CAM007 | Campaign Planner — Custom Column View | /admin/campaign/planner | V3_REMEDIATION_CAMPAIGN_WIREFRAMES_V2 |

## Supplemental source PNGs

- `017_RELEASE_V090.png`
- `020_PUB017.png`
- `255_ADM036.png`
