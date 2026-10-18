// Todo List Application with Date Support
class TodoApp {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.editingId = null;
        this.currentEditValue = '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        const input = document.getElementById('todo-input');
        const dateInput = document.getElementById('date-input');
        const addButton = document.getElementById('add-btn');
        const todoList = document.querySelector('.container');
        const fields = [input, dateInput];

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

            if (e.target.classList.contains('delete-btn')) {
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

    createTodoElement(todo, showDate = false, animateId = null) {
        const todoItem = document.createElement('li');
        todoItem.className = todo.id === animateId ? 'todo-item todo-enter' : 'todo-item';
        todoItem.dataset.id = todo.id;
        const dateHtml = showDate && todo.date
            ? `<span class="todo-date overdue">${this.formatDate(todo.date)}</span>`
            : '';
        todoItem.innerHTML = `
            <span class="todo-text">${this.escapeHtml(todo.task)}</span>
            ${dateHtml}
            <input type="text" class="todo-input" style="display: none;" aria-label="Edit task">
            <button class="delete-btn">Delete</button>
        `;
        return todoItem;
    }

    getTodayDate() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

    renderGrid(animateId = null) {
        const groupedTodos = {};
        const todayDate = this.getTodayDate();
        this.todos.forEach(todo => {
            if (todo.date && todo.date > todayDate) {
                (groupedTodos[todo.date] ||= []).push(todo);
            }
        });

        const gridContainer = document.getElementById('todo-grid');
        const gridContent = gridContainer.querySelector('.grid-content');
        gridContent.innerHTML = '';
        const dates = Object.keys(groupedTodos).sort();
        gridContainer.hidden = dates.length === 0;

        // Render every future date, wrapping into additional rows as needed.
        dates.forEach(dateKey => {
            const dateElement = document.createElement('div');
            dateElement.className = 'grid-item';
            const label = document.createElement('h3');
            label.className = 'date-label';
            label.textContent = this.parseLocalDate(dateKey).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
            });
            const tasks = document.createElement('ul');
            tasks.className = 'tasks';
            groupedTodos[dateKey].forEach(todo => tasks.appendChild(this.createTodoElement(todo, false, animateId)));
            dateElement.appendChild(label);
            dateElement.appendChild(tasks);
            gridContent.appendChild(dateElement);
        });
    }

    startEditing(id, clickEvent) {
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

    deleteTodo(id) {
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveTodos();

        this.render();
    }

    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    render(animateId = null) {
        this.cancelEdit();
        const todayDate = this.getTodayDate();
        const todoList = document.getElementById('todo-list');
        const todayTodos = this.todos.filter(todo => !todo.date || todo.date === todayDate);
        todoList.innerHTML = '';
        todayTodos.forEach(todo => todoList.appendChild(this.createTodoElement(todo, false, animateId)));
        if (todayTodos.length === 0) {
            todoList.innerHTML = '<li class="empty-message">No tasks for today. Add one above!</li>';
        }

        this.renderGrid(animateId);

        // Keep unfinished past tasks accessible without mixing them into Today.
        const overdueSection = document.getElementById('overdue-section');
        const overdueList = document.getElementById('overdue-list');
        const overdueTodos = this.todos.filter(todo => todo.date && todo.date < todayDate);
        overdueSection.hidden = overdueTodos.length === 0;
        overdueList.innerHTML = '';
        overdueTodos.forEach(todo => overdueList.appendChild(this.createTodoElement(todo, true, animateId)));
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
