# Environment Feedback Report
## Mode: architect
## Date: 260728
## Issue: Crow recall exposes different enum values for register and domain

### Problem Description
- What happened: A Crow recall request used `register: code`, following the tool's code-domain terminology, and failed input validation.
- When it occurred: Before continuing combined-branch and Mimo-exclusive dependency analysis.
- Error message: `Input validation error: 'code' is not one of ['style', 'bug', 'arch', 'context', 'life_pref', 'life_avoid', 'life_phil', 'life_context', 'all']`.

### Root Cause Analysis
- Why it happened: The tool exposes `code` as a valid `domain` shortcut but not as a valid `register`; these adjacent parameters use different enum vocabularies.

### Workaround/Solution
- How I solved it: Continue using `register: all` or a concrete register such as `arch`; use `domain: code` only when applying the shortcut.
- What I tried: One recall request. It was not repeated with identical parameters.

### Ideal Environment
- What would be ideal: Use the same accepted vocabulary for both parameters, or make the validation error explicitly say, `Use domain=code or register=arch/style/bug/context`.

### Additional Notes
- The failed read-only memory call did not affect repository state or analysis artifacts.
