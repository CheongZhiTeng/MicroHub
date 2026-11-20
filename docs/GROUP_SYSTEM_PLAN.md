# MicroHub product plan with groups

**Plan with confirmed permissions · 20 November 2026 · Asia/Kuala_Lumpur**

MicroHub remains one school club. Groups sit inside the club and organise student membership, homework, announcements and events. Every student can see club-wide content and the content for their own group. Expo and GitHub Pages use the same Supabase data and permission rules.

## 1. Group structure and member assignment

- An active group has one teacher, one or two student leaders, and a student roster. Leaders count as members of that group. A student has one active group assignment at a time. Students awaiting placement appear in an **Unassigned** queue and can still see all-student content.
- The Super Admin creates the group, appoints its teacher and can assign or transfer any student. The teacher maintains their own group roster and appoints or replaces leaders from that roster. Teachers can add unassigned students to their own group. Transfers across groups go through a Super Admin.
- A group can be set up as a draft before all required roles are filled. Activation requires the teacher and at least one leader. Replacing the teacher or final leader happens in one operation. If a staff account is suspended, access ends immediately and the Super Admin sees a vacancy to resolve.
- The group screen shows its teacher, leaders, student roster and group content. Teachers and Super Admins get a management view with search by either name or student ID, an assignment preview, and a change history. Record who made each membership or leadership change and when.

## 2. Permissions

A teacher has Super Admin-level controls within the group they teach. The project owner is one of the teachers for this workflow, so a teacher account needs to do its daily work using the group role alone. The existing global Super Admin can manage every group. Site-wide roles, school-wide settings and cross-group transfers belong to the global Super Admin.

| Action                                          | Global Super Admin                | Group teacher                                                                | Group leader                                             | Student                                              |
| ----------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Create groups and appoint teachers              | Any group                         | View their group                                                             | View their group                                         | View their group                                     |
| Assign students and appoint leaders             | Any group, including transfers    | Add unassigned students and manage the roster and leaders in their own group | View their group roster                                  | View their own group                                 |
| Create and publish homework                     | Any group or all-student audience | Own group                                                                    | Own group                                                | View assignments addressed to them                   |
| Read submissions, mark and release feedback     | Any authorised assignment         | Own group's assignments                                                      | Own group's assignments, excluding their own submissions | Submit and read their own work and released feedback |
| Publish and manage announcements and events     | Any group or all-student audience | Own group                                                                    | View published content available to them                 | View published content available to them             |
| Manage global accounts, roles and club settings | Yes                               | Group membership controls only                                               | —                                                        | Own profile                                          |

The existing global Admin continues membership review and their existing club-wide homework duties. Group access comes from an explicit group role. Student leaders retain their student access. Leaders release grades and feedback for their group directly. A teacher or Super Admin marks a leader's own submission. Announcement and calendar publishing belongs to group teachers and global Super Admins.

## 3. Homework

- Reuse the existing authoring, recipient snapshots, private drafts, versioned submissions, grades and feedback. Staff choose **All students**, **A group**, or **Selected students within a group** according to their permission. A leader's audience picker is limited to their group and its students.
- The student Homework page lists their club-wide and group assignments together. An audience label identifies where each assignment came from. Group staff can see due, submitted, missing and graded work for the assignments they can manage. Grades, feedback and revision requests keep the existing draft and release rules.
- On publication, record the group and its recipient snapshot. Later arrivals receive already-published work only when eligible staff explicitly add them. Moving a student keeps previous submissions, receipts and released grades in their private history. Old group assignments leave their active task list, and old group submissions close to further student edits or resubmissions after the transfer. Staff responsible for the old assignment retain its grading history. New group staff can access the student's assignments in the new group.
- Students continue to submit individually. Shared submissions by multiple students remain a separate future Homework feature.

## 4. Announcements, events and Home

| Screen            | What students see                                                                                                           | What authorised staff can do                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Home**          | One announcement feed and one calendar that combine **All students** posts and events with **My group** posts and events    | Preview the combined student view. Teachers see their group's content alongside all-student content. |
| **Announcements** | Published posts with audience labels and filters for **All**, **All students** and **My group**                             | Draft, preview, publish, edit and archive in scope. Show pinned announcements first, then newest.    |
| **Calendar**      | A combined month calendar and upcoming agenda with both audiences labelled. Select an item for its time, venue and details. | Create, preview, publish, update or cancel timed and all-day events in scope.                        |
| **My Group**      | Teacher, leaders, roster and links to the group's work, announcements and calendar                                          | Manage the group from the administration area when assigned as staff.                                |

All-student content remains visible to approved active members awaiting placement. Moving groups updates Home, Announcements and Calendar to the new audience. Store event timestamps in UTC and display school dates and times in Malaysia time. Keep the English and Simplified Chinese switch and both profile name fields available across these screens.

## 5. Data and access

- Add group and membership records through additive Supabase migrations. Keep group duties separate from global roles. Use database constraints and transactional server operations for single-group placement, teacher assignment, leader limits and transfers. Recheck active membership and group permissions when an assignment is published, an item is read or a grade is released.
- Add a group scope to homework, announcements and events. Existing assignments retain their original audience and submission history. Require a new draft if staff need to publish the same material to a different audience. Use shared audience rules in feeds, detail pages, grading and counts so searching, opening a direct link or querying Supabase returns the same authorised data.
- After removal, transfer, demotion or suspension, refresh or clear cached group data on the next access. Record changes to assignments, grades, membership and communications in the relevant audit trail. Preserve published history through archival.

## 6. Updated delivery order

| Phase                                 | Deliverable                                                                                                                                                                                                                                                                          | Release check                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **0. Confirm the current release**    | Verify the hosted Supabase migration history and connect a test environment. Verify login, bilingual profiles and the existing individual homework flow before building on it.                                                                                                       | Existing accounts, grades and drafts remain usable on web and Expo.                                                                 |
| **1. Group foundations**              | Group records, role checks, **My Group**, and administrative assignment and transfer screens.                                                                                                                                                                                        | One teacher, one or two leaders, and one group per student. Concurrent role or roster updates obey the same rules.                  |
| **2. Group homework**                 | Extend the existing workflow to group teachers, leaders and students. Keep club-wide homework available.                                                                                                                                                                             | A teacher assigns students, a leader publishes and marks their group's homework, and students can read their own released feedback. |
| **3. Communications and Home**        | Deliver basic announcements, calendar events and the combined Home views earlier in the roadmap.                                                                                                                                                                                     | Two groups see the same all-student items and different group items. Edits and cancellations appear in all relevant views.          |
| **4. Finish the remaining MVP**       | Complete homework attachments and deadline controls, secure attendance and personal history, the pending membership and administration tools, and dashboards.                                                                                                                        | Exercise web and Expo with realistic roles and devices, including permissions, transfers and reconnection.                          |
| **5. Continue the V1 and V2 roadmap** | V1 includes RSVP, recurring events and reminders, announcement interactions and read receipts, shared homework submissions, and analytics and exports. V2 retains the existing extensions, including resources, offline features, attendance extensions and account lifecycle tools. | Add permission and device checks as each feature ships.                                                                             |

## 7. Acceptance and publishing

1. Create two test groups, each with a teacher, and exercise one-leader and two-leader rosters. Confirm the interface rejects a third leader, duplicate student placement and a leader assigning members.
2. Publish all-student and group-only announcements and events. Check Home, filters, direct links and Supabase access as members of both groups and as an unassigned student.
3. As a teacher with group permissions only, manage your roster and publish an announcement and an event for your group. Verify writes to another group and club-wide publishing are denied. As a leader, publish and mark group homework and release feedback directly. Verify that marking your own work, accessing the other group's grades or submissions, and publishing announcements or events are denied. Check the existing all-student homework flow.
4. Transfer a student with an existing submission. Confirm the old group content and active tasks disappear, the student's own historical receipt and released grade remain, and the new group appears across web and mobile. Check role revocation on an already signed-in session.
5. After each verified feature release, update the progress log, sync the base and GitHub Pages branches, wait for the deployment, and confirm the live site serves the expected commit. Verify hosted migrations separately and keep the existing app usable during the rollout.
