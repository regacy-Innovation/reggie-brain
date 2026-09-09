# List header save boundary

- Authoritative inputs: the editable list name, industry classification, and technology classification in `ListNameEditable.svelte`.
- Persistent writes: `PUT /db/CompanyList/:id` for the list name, followed when a prompt exists by `PUT /db/Prompt/:id` for industry and technology classifications.
- Persistent identifiers: `headerCompanyListId` and the loaded prompt ID.
- UI ordering: keep the editor open and inputs disabled while writes run; close only after every required write resolves; keep the submitted values visible and show a localized cause when any write rejects.
- Validation: trim the list name and reject an empty result before issuing either API request.
- Local reflection: the route updates the module shell or company-list state after the list write, then updates prompt classification state after the prompt write.
- Confirmed defects: an empty list name reached the API, and a rejected API promise left the editor open without any visible explanation.
