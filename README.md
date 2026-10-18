# Todo List

A simple todo app built with HTML, CSS, and JavaScript.

## Features

- Require task text and a due date, with shake feedback for missing information.
- List today's tasks in the order they were added.
- Group future tasks by date in a responsive grid.
- Open History above the Add button to view past tasks grouped by date in a right-side panel.
- Move today's tasks to History at local midnight and bring the next day's tasks into Today.
- Review yesterday's unfinished tasks and roll over all or selected tasks to Today in orange.
- Preserve the original History entries and prevent duplicate rollovers.
- Click task text to edit it, then press Enter to save. Click away to cancel.
- Delete tasks and save changes in the browser's local storage.
- Check off tasks with an animated green check mark, or click again to uncheck.
- Display dates using the local calendar day.

## Run locally

Open `index.html` in a browser. No dependencies or build step are required.

Alternatively, serve the project with Python:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://localhost:8000`.

Tasks are stored in the current browser for the address used to open the app.
They do not sync between browsers or devices.

## Project structure

```text
index.html      Page structure and task input fields
style.css       Layout, styling, and animations
script.js       Task management, validation, rendering, and storage
```
