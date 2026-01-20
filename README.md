# QuayeWorks Testing Site

A simple site for learners to sign in, pick a class, and practice questions in one place.

## Features

- Login-gated access (demo credentials)
- Course catalog UI
- CLS exam runner:
  - Multiple choice (single)
  - Select all that apply
  - Select all that do NOT apply
  - Drag & drop matching
  - Drag & drop ordering
  - True/False
  - Autosave (localStorage)
  - Timer (optional)
  - Grading and score report
  - Randomized question order per attempt

## Demo Credentials

- **Username:** GoArmy
- **Password:** GoArmy

> **Security note:** This is not real authentication. It’s a simple front-end gate intended for local/static use.

## Courses

- **CLS (enabled):** launches the CLS practice exam.
- **Cisco IT (locked):** visible but disabled (“Coming soon”).

## How to Run

No build tools needed.

1. Download the project folder.
2. Open `index.html` in a browser (Chrome/Edge recommended).
3. Log in with the demo credentials.
4. Choose CLS to start the exam.

## Resetting Progress

The app stores progress in localStorage.

- Use the Reset button inside the exam to clear answers.
- Or clear site data in your browser to wipe everything.

## Customizing Questions

Questions live in the `EXAM.questions` array in `scripts/exam-data.js`.

Example True/False question:

```js
{
  id: "q_tf_1",
  type: "true_false",
  points: 1,
  prompt: "A tourniquet should be loosened periodically once applied.",
  answer: false,
  note: "Once applied, a tourniquet is NOT loosened unless directed by protocol."
}
```

## Adding New Courses Later

To add a new course:

- Add a tile to the Course Catalog.
- Add a new exam data object (like `EXAM_CLS`).
- Route to a new exam view/page.
- Implement content + grading rules.

## Branding

- Army logo displayed in header.
- QuayeWorks logo pulled from GitHub avatar URL.
