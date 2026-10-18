// Todo List Application with Date Support
class TodoApp {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.editingId = null;
        this.currentEditValue = '';
        this.deletingIds = new Set();
        this.deletionAnimations = [];
        this.todayLayoutAnimation = null;
        this.currentDay = this.getTodayDate();
        // Give older undated tasks a stable day so they can enter History too.
        if (this.todos.some(todo => !todo.date)) {
            this.todos.forEach(todo => { if (!todo.date) todo.date = this.currentDay; });
            this.saveTodos();
        }
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.scheduleDayRollover();
    }

    refreshDay() {
        const today = this.getTodayDate();
        if (today !== this.currentDay) {
            this.currentDay = today;
            this.render();
        }
    }

    scheduleDayRollover() {
        clearTimeout(this.dayRolloverTimer);
        const now = new Date();
        const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        this.dayRolloverTimer = setTimeout(() => {
            this.refreshDay();
            this.scheduleDayRollover();
        }, nextDay.getTime() - now.getTime() + 50);
    }

    bindEvents() {
        const input = document.getElementById('todo-input');
        const dateInput = document.getElementById('date-input');
        const addButton = document.getElementById('add-btn');
        const todoList = document.querySelector('.container');
        const fields = [input, dateInput];

        const historyLink = document.getElementById('history-link');
        const historySection = document.getElementById('history-section');
        historyLink.addEventListener('click', (event) => {
            event.preventDefault();
            this.refreshDay();
            historySection.hidden = !historySection.hidden;
            historyLink.setAttribute('aria-expanded', String(!historySection.hidden));
            if (!historySection.hidden) historySection.scrollIntoView({ block: 'nearest' });
        });
        document.getElementById('history-close-btn').addEventListener('click', () => {
            historySection.hidden = true;
            historyLink.setAttribute('aria-expanded', 'false');
            historyLink.focus();
        });
        const checkDay = () => {
            this.refreshDay();
            this.scheduleDayRollover();
        };
        window.addEventListener('focus', checkDay);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) checkDay();
        });

        document.getElementById('review-rollover-btn').addEventListener('click', () => {
            this.refreshDay();
            this.dismissRolloverPrompt();
            historySection.hidden = false;
            historyLink.setAttribute('aria-expanded', 'true');
            historySection.scrollIntoView({ block: 'start' });
            document.getElementById('rollover-all-btn').focus();
        });
        document.getElementById('dismiss-rollover-btn').addEventListener('click', () => this.dismissRolloverPrompt());
        document.getElementById('rollover-all-btn').addEventListener('click', () => {
            this.rollOverTasks(this.getRolloverCandidates().map(todo => todo.id));
        });
        const historyContent = document.getElementById('history-content');
        historyContent.addEventListener('change', () => {
            document.getElementById('rollover-selected-btn').disabled =
                historyContent.querySelectorAll('.rollover-choice:checked').length === 0;
        });
        document.getElementById('rollover-selected-btn').addEventListener('click', () => {
            const ids = Array.from(historyContent.querySelectorAll('.rollover-choice:checked'))
                .map(input => Number(input.dataset.id));
            this.rollOverTasks(ids);
        });

        const updateValidity = (field) => {
            if (field === input) {
                input.setCustomValidity(input.value.trim() ? '' : 'Please enter a task.');
            }
            const valid = field.validity.valid;
            if (valid) {
                field.removeAttribute('aria-invalid');
                field.classList.remove('input-shake');
            }
            return valid;
        };

        fields.forEach(field => {
            field.addEventListener('input', () => updateValidity(field));
            field.addEventListener('change', () => updateValidity(field));
            field.addEventListener('animationend', () => field.classList.remove('input-shake'));
        });

        let isSubmitting = false;
        const submitTodo = async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            const invalidFields = fields.filter(field => !updateValidity(field));
            if (invalidFields.length) {
                invalidFields.forEach(field => {
                    field.setAttribute('aria-invalid', 'true');
                    field.classList.remove('input-shake');
                    // Restart the animation even on repeated invalid submissions.
                    void field.offsetWidth;
                    field.classList.add('input-shake');
                });
                invalidFields[0].focus();
                invalidFields[0].reportValidity();
                return;
            }
            const task = input.value;
            const dueDate = dateInput.value;
            isSubmitting = true;
            try {
                await this.animateInputReset(fields);
                await new Promise(resolve => setTimeout(resolve, 180));
                this.addTodo(task, dueDate);
            } finally {
                isSubmitting = false;
                input.focus();
            }
        };

        // Use the same validation for the button and keyboard.
        addButton.addEventListener('click', submitTodo);

        // Add todo on Enter from either field.
        fields.forEach(field => {
            field.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submitTodo(e);
            });
        });

        // Handle todo item clicks
        todoList.addEventListener('click', (e) => {
            const item = e.target.closest('.todo-item');
            if (!item) return;

            const id = parseInt(item.dataset.id);

            if (e.target.closest('.completion-toggle')) {
                this.toggleTodo(id);
            } else if (e.target.classList.contains('delete-btn')) {
                this.deleteTodo(id);
            } else if (e.target.classList.contains('todo-text')) {
                this.startEditing(id, e);
            }
        });

        // Handle input blur (don't save on blur)
        todoList.addEventListener('blur', (e) => {
            if (e.target.classList.contains('todo-input')) {
                this.cancelEdit();
            }
        }, true);

        // Handle Enter key in input
        todoList.addEventListener('keypress', (e) => {
            if (e.target.classList.contains('todo-input') && e.key === 'Enter') {
                e.preventDefault();
                this.saveEdit();
            }
        });
    }

    async animateInputReset(fields) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animations = [];
        const layers = [];

        try {
            fields.forEach(field => {
                const previousValue = field.type === 'date'
                    ? field.value.split('-').slice(1).concat(field.value.split('-')[0]).join('/')
                    : field.value;
                field.value = '';
                if (reduceMotion) return;

                field.readOnly = true;
                const layer = document.createElement('div');
                layer.className = 'slot-reel';
                layer.setAttribute('aria-hidden', 'true');
                const outgoing = document.createElement('span');
                outgoing.className = 'slot-value';
                outgoing.textContent = previousValue;
                const incoming = document.createElement('span');
                incoming.className = 'slot-value slot-placeholder';
                incoming.textContent = field.type === 'date' ? 'mm/dd/yyyy' : field.placeholder;
                layer.append(outgoing, incoming);
                field.parentNode.appendChild(layer);
                layers.push(layer);

                animations.push(outgoing.animate([
                    { transform: 'translateY(0)', opacity: 1 },
                    { transform: 'translateY(120%)', opacity: 0 }
                ], { duration: 300, easing: 'ease-in', fill: 'forwards' }));
                animations.push(incoming.animate([
                    { transform: 'translateY(-120%)', opacity: 0 },
                    { transform: 'translateY(0)', opacity: 1 }
                ], { delay: 180, duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }));
            });
            await Promise.allSettled(animations.map(animation => animation.finished));
        } finally {
            layers.forEach(layer => layer.remove());
            animations.forEach(animation => animation.cancel());
            fields.forEach(field => { field.readOnly = false; });
        }
    }

    addTodo(task, date) {
        if (task.trim() === '' || !date) return;

        const newTodo = {
            id: Date.now(),
            task: task.trim(),
            date: date,
            completed: false
        };

        this.todos.push(newTodo);
        this.saveTodos();

        this.render(newTodo.id);
    }

    createTodoElement(todo, showDate = false, animateId = null, useSlotEntrance = false) {
        const todoItem = document.createElement('li');
        const isNewTodo = todo.id === animateId;
        const slotEntrance = isNewTodo && useSlotEntrance;
        todoItem.className = 'todo-item';
        if (todo.completed) todoItem.className += ' is-completed';
        if (todo.rolledOverFrom) todoItem.className += ' is-rolled-over';
        if (isNewTodo) {
            todoItem.className += slotEntrance ? ' todo-slot-enter' : ' todo-enter';
        }
        todoItem.dataset.id = todo.id;
        const dateHtml = showDate && todo.date
            ? `<span class="todo-date overdue">${this.formatDate(todo.date)}</span>`
            : '';
        const content = `
            <button type="button" class="completion-toggle" role="checkbox" aria-checked="${Boolean(todo.completed)}" aria-label="${todo.completed ? 'Mark task incomplete' : 'Mark task complete'}">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path class="completion-mark" d="M4 10l4 4 8-8" pathLength="1"></path>
                </svg>
            </button>
            <span class="todo-text">${this.escapeHtml(todo.task)}</span>
            ${dateHtml}
            <input type="text" class="todo-input" style="display: none;" aria-label="Edit task">
            <button class="delete-btn">Delete</button>
        `;
        todoItem.innerHTML = slotEntrance
            ? `<div class="todo-slot-content">${content}</div>`
            : content;
        return todoItem;
    }

    getTodayDate() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    getRolloverCandidates() {
        const yesterday = this.parseLocalDate(this.getTodayDate());
        yesterday.setDate(yesterday.getDate() - 1);
        const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        return this.todos.filter(todo => todo.date === key && !todo.completed && !todo.rolledOverTo
            && !this.deletingIds.has(todo.id));
    }

    dismissRolloverPrompt() {
        localStorage.setItem('rolloverPromptDismissed', this.getTodayDate());
        this.renderRolloverPrompt();
    }

    renderRolloverPrompt() {
        const count = this.getRolloverCandidates().length;
        const dismissed = localStorage.getItem('rolloverPromptDismissed') === this.getTodayDate();
        document.getElementById('rollover-prompt').hidden = count === 0 || dismissed;
        document.getElementById('rollover-message').textContent =
            `You have ${count} unfinished ${count === 1 ? 'task' : 'tasks'} from yesterday. Would you like to roll any over to today?`;
    }

    rollOverTasks(ids) {
        this.refreshDay();
        const selectedIds = new Set(ids);
        const candidates = this.getRolloverCandidates().filter(todo => selectedIds.has(todo.id));
        if (candidates.length === 0) return;
        const today = this.getTodayDate();
        let nextId = this.todos.reduce((max, todo) => Math.max(max, Number(todo.id) || 0), Date.now());
        candidates.forEach(todo => {
            this.todos.push({
                id: ++nextId,
                task: todo.task,
                date: today,
                completed: false,
                rolledOverFrom: todo.date
            });
            // Keep the original day's record and prevent rolling it over twice.
            todo.rolledOverTo = today;
        });
        this.saveTodos();
        this.render();
        document.getElementById('rollover-result').textContent =
            `${candidates.length} ${candidates.length === 1 ? 'task rolled' : 'tasks rolled'} over to Today.`;
    }

    parseLocalDate(dateString) {
        // Date-only strings must use local midnight, rather than UTC midnight.
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    getDateClass(dateString) {
        if (!dateString) return '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const taskDate = this.parseLocalDate(dateString);
        taskDate.setHours(0, 0, 0, 0);

        if (taskDate.getTime() === today.getTime()) {
            return 'today';
        } else if (taskDate > today) {
            return 'upcoming';
        } else {
            return 'overdue';
        }
    }

    formatDate(dateString) {
        if (!dateString) return '';

        const date = this.parseLocalDate(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    renderGrid(animateId = null, animateRemoval = false) {
        const groupedTodos = {};
        const todayDate = this.getTodayDate();
        this.todos.forEach(todo => {
            if (todo.date && todo.date > todayDate) {
                (groupedTodos[todo.date] ||= []).push(todo);
            }
        });

        const gridContainer = document.getElementById('todo-grid');
        const gridContent = gridContainer.querySelector('.grid-content');
        const animateLayout = (animateRemoval || (animateId !== null
            && this.todos.some(todo => todo.id === animateId && todo.date > todayDate)))
            && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const previousPositions = new Map();
        if (animateLayout && !gridContainer.hidden) {
            Array.from(gridContent.children).forEach(card => {
                previousPositions.set(card.dataset.date, card.getBoundingClientRect());
            });
        }
        gridContent.innerHTML = '';
        const dates = Object.keys(groupedTodos).sort();
        const revealUpcoming = gridContainer.hidden && dates.length > 0 && animateId !== null;
        gridContainer.classList.toggle('upcoming-intro', revealUpcoming);
        gridContainer.hidden = dates.length === 0;

        // Render every future date, wrapping into additional rows as needed.
        dates.forEach(dateKey => {
            const dateElement = document.createElement('div');
            dateElement.dataset.date = dateKey;
            const containsNewTodo = groupedTodos[dateKey].some(todo => todo.id === animateId);
            dateElement.className = containsNewTodo && !revealUpcoming ? 'grid-item grid-card-enter' : 'grid-item';
            const label = document.createElement('h3');
            label.className = 'date-label';
            label.textContent = this.parseLocalDate(dateKey).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
            });
            const tasks = document.createElement('ul');
            tasks.className = 'tasks';
            groupedTodos[dateKey].forEach(todo => tasks.appendChild(this.createTodoElement(todo)));
            dateElement.appendChild(label);
            dateElement.appendChild(tasks);
            gridContent.appendChild(dateElement);
        });

        // Carry existing cards smoothly from their old layout into the new grid.
        const cardPositions = Array.from(gridContent.children).map(card => ({
            card,
            previous: previousPositions.get(card.dataset.date),
            next: animateLayout ? card.getBoundingClientRect() : null
        }));
        cardPositions.forEach(({ card, previous, next }) => {
            if (!previous || card.classList.contains('grid-card-enter')) return;
            const x = previous.left - next.left;
            const y = previous.top - next.top;
            if (x === 0 && y === 0 && previous.width === next.width) return;
            card.animate([
                { transform: `translate(${x}px, ${y}px)`, width: `${previous.width}px` },
                { transform: 'translate(0, 0)', width: `${next.width}px` }
            ], { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        });
    }

    startEditing(id, clickEvent) {
        if (this.deletingIds.has(id)) return;
        // Cancel any existing edit
        this.cancelEdit();

        // Set editing state
        this.editingId = id;

        // Update DOM to show input field
        const todoItem = document.querySelector(`[data-id="${id}"]`);
        if (todoItem) {
            const todoText = todoItem.querySelector('.todo-text');
            const todoInput = todoItem.querySelector('.todo-input');

            // Store original text
            this.currentEditValue = todoText.textContent;

            // Show input and hide text
            todoInput.value = todoText.textContent;
            todoText.style.display = 'none';
            todoInput.style.display = 'inline-block';

            // Focus input
            todoInput.focus();
        }
    }

    saveEdit() {
        if (this.editingId === null) return;

        const todoItem = document.querySelector(`[data-id="${this.editingId}"]`);
        if (!todoItem) return;

        const todoText = todoItem.querySelector('.todo-text');
        const todoInput = todoItem.querySelector('.todo-input');
        const newText = todoInput.value.trim();

        if (newText !== '' && newText !== this.currentEditValue) {
            // Update in data
            const todoIndex = this.todos.findIndex(todo => todo.id === this.editingId);
            if (todoIndex !== -1) {
                this.todos[todoIndex].task = newText;
                this.saveTodos();

                // Update DOM
                todoText.textContent = newText;
                todoText.style.display = 'inline-block';
                todoInput.style.display = 'none';

                // Restart the green flash and let the full fade finish.
                todoText.classList.remove('saved');
                void todoText.offsetWidth;
                todoText.classList.add('saved');
                todoText.onanimationend = (event) => {
                    if (event.animationName === 'flash') {
                        todoText.classList.remove('saved');
                    }
                };
            }
        } else {
            // Cancel edit if empty or unchanged
            this.cancelEdit();
        }

        this.editingId = null;
    }

    cancelEdit() {
        if (this.editingId === null) return;

        const todoItem = document.querySelector(`[data-id="${this.editingId}"]`);
        if (todoItem) {
            const todoText = todoItem.querySelector('.todo-text');
            const todoInput = todoItem.querySelector('.todo-input');

            // Restore text and hide input
            todoText.style.display = 'inline-block';
            todoInput.style.display = 'none';
        }

        this.editingId = null;
    }

    toggleTodo(id) {
        if (this.deletingIds.has(id)) return;
        const todo = this.todos.find(todo => todo.id === id);
        if (!todo) return;
        todo.completed = !todo.completed;
        this.saveTodos();
        if (todo.date < this.getTodayDate()) {
            this.render();
            return;
        }

        const item = document.querySelector(`[data-id="${id}"]`);
        if (!item) return;
        item.classList.toggle('is-completed', todo.completed);
        const button = item.querySelector('.completion-toggle');
        button.setAttribute('aria-checked', String(todo.completed));
        button.setAttribute('aria-label', todo.completed ? 'Mark task incomplete' : 'Mark task complete');
    }

    async deleteTodo(id) {
        if (this.deletingIds.has(id)) return;
        this.deletingIds.add(id);
        const todoItem = document.querySelector(`[data-id="${id}"]`);
        let fadeTarget = todoItem;
        const card = todoItem?.closest('.grid-item');
        if (card && card.querySelectorAll('.todo-item').length === 1) {
            fadeTarget = card;
            const grid = document.getElementById('todo-grid');
            if (grid.querySelectorAll('.todo-item').length === 1) fadeTarget = grid;
        }

        try {
            if (fadeTarget && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                const animation = fadeTarget.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], { duration: 300, easing: 'ease-in-out', fill: 'forwards' });
                this.deletionAnimations.push(animation);
                await animation.finished.catch(() => {});
            }
            this.todos = this.todos.filter(todo => todo.id !== id);
            this.saveTodos();
        } finally {
            this.deletingIds.delete(id);
            // Preserve the old card positions until every fade has finished.
            if (this.deletingIds.size === 0) {
                this.render(null, true);
                this.deletionAnimations.forEach(animation => animation.cancel());
                this.deletionAnimations = [];
            }
        }
    }

    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    render(animateId = null, animateRemoval = false) {
        this.cancelEdit();
        const todayDate = this.getTodayDate();
        const todoList = document.getElementById('todo-list');
        const todayTodos = this.todos.filter(todo => !todo.date || todo.date === todayDate);
        const animateTodayLayout = (animateRemoval || todayTodos.some(todo => todo.id === animateId))
            && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const previousHeight = animateTodayLayout ? todoList.getBoundingClientRect().height : null;
        const previousRows = new Map();
        if (animateRemoval && animateTodayLayout) {
            Array.from(todoList.children).forEach(row => {
                previousRows.set(row.dataset.id, row.getBoundingClientRect());
            });
        }
        this.todayLayoutAnimation?.cancel();
        this.todayLayoutAnimation = null;
        todoList.innerHTML = '';
        todayTodos.forEach(todo => todoList.appendChild(this.createTodoElement(todo, false, animateId, true)));
        if (todayTodos.length === 0) {
            todoList.innerHTML = '<li class="empty-message">No tasks for today. Add one above!</li>';
        }

        if (animateTodayLayout) {
            const nextHeight = todoList.getBoundingClientRect().height;
            const rowPositions = Array.from(todoList.children).map(row => ({
                row,
                previous: previousRows.get(row.dataset.id),
                next: row.getBoundingClientRect()
            }));
            rowPositions.forEach(({ row, previous, next }) => {
                if (!previous || previous.top === next.top) return;
                row.animate([
                    { transform: `translateY(${previous.top - next.top}px)` },
                    { transform: 'translateY(0)' }
                ], { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
            });
            if (previousHeight !== nextHeight) {
                // Resize the list so every section below it moves together.
                this.todayLayoutAnimation = todoList.animate([
                    { height: `${previousHeight}px`, overflow: 'hidden' },
                    { height: `${nextHeight}px`, overflow: 'hidden' }
                ], { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
            }
        }

        this.renderGrid(animateId, animateRemoval);

        this.renderHistory(todayDate);
        this.renderRolloverPrompt();
    }

    renderHistory(todayDate) {
        const content = document.getElementById('history-content');
        content.innerHTML = '';
        document.getElementById('rollover-result').textContent = '';
        const eligibleIds = new Set(this.getRolloverCandidates().map(todo => todo.id));
        document.getElementById('rollover-controls').hidden = eligibleIds.size === 0;
        document.getElementById('rollover-selected-btn').disabled = true;
        const grouped = {};
        this.todos.forEach(todo => {
            if (todo.date < todayDate) (grouped[todo.date] ||= []).push(todo);
        });
        const dates = Object.keys(grouped).sort().reverse();
        if (dates.length === 0) {
            const message = document.createElement('p');
            message.className = 'empty-message';
            message.textContent = 'No past tasks yet. Today’s tasks will appear here when the day ends.';
            content.appendChild(message);
        }
        dates.forEach(date => {
            const day = document.createElement('section');
            day.className = 'history-day';
            const heading = document.createElement('h3');
            heading.className = 'history-date';
            heading.textContent = this.parseLocalDate(date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });
            const list = document.createElement('ul');
            list.className = 'task-list';
            grouped[date].forEach(todo => {
                const item = this.createTodoElement(todo);
                if (eligibleIds.has(todo.id)) {
                    const label = document.createElement('label');
                    label.className = 'rollover-select';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'rollover-choice';
                    checkbox.dataset.id = todo.id;
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode('Roll over'));
                    item.prepend(label);
                } else if (todo.rolledOverTo) {
                    const note = document.createElement('span');
                    note.className = 'rollover-note';
                    note.textContent = `Rolled over to ${this.formatDate(todo.rolledOverTo)}`;
                    item.appendChild(note);
                }
                list.appendChild(item);
            });
            day.appendChild(heading);
            day.appendChild(list);
            content.appendChild(day);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
});
