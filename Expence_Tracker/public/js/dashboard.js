document.addEventListener('DOMContentLoaded', () => {
	const ChartLib = window.Chart;
	const CATEGORY_COLORS = ['#4f46e5', '#22c55e', '#f97316', '#f43f5e', '#0ea5e9', '#8b5cf6'];
	const analyticsEndpoint = '/api/analytics/dashboard';
	const chartInstances = {};

	function parseEmbeddedAnalytics() {
		const element = document.getElementById('dashboard-analytics-data');
		if (!element) {
			return null;
		}

		try {
			return JSON.parse(element.textContent || '{}');
		} catch (error) {
			console.error('Unable to parse embedded analytics payload', error);
			return null;
		} finally {
			element.remove();
		}
	}

	function createEmptyAnalytics() {
		return {
			totals: {
				income: 0,
				expense: 0,
				savings: 0,
				savingsRate: 0,
			},
			charts: {
				incomeVsExpense: { labels: ['Income', 'Expense'], data: [0, 0], hasValues: false },
				savingsTrend: { labels: [], income: [], expense: [], savings: [], hasValues: false },
				expenseByCategory: { labels: [], data: [], hasValues: false },
				incomeBySource: { labels: [], data: [], hasValues: false },
			},
		};
	}

	function formatCurrency(value) {
		const numeric = Number(value) || 0;
		const sign = numeric < 0 ? '- ' : '';
		return `${sign}Rs ${Math.abs(numeric).toFixed(2)}`;
	}

	function formatPercentage(value) {
		const numeric = Number(value) || 0;
		return `${numeric.toFixed(1)}%`;
	}

	function setMetric(name, value, formatter = formatCurrency) {
		const target = document.querySelector(`[data-metric="${name}"]`);
		if (!target) {
			return;
		}

		target.textContent = formatter(value);
	}

	function destroyChart(key) {
		if (chartInstances[key]) {
			chartInstances[key].destroy();
			chartInstances[key] = null;
		}
	}

	function toggleEmptyState(key, hasData, canvasId) {
		const emptyElement = document.querySelector(`[data-empty="${key}"]`);
		if (emptyElement) {
			emptyElement.classList.toggle('hidden', hasData);
		}

		if (!canvasId) {
			return;
		}

		const canvas = document.getElementById(canvasId);
		if (canvas) {
			canvas.classList.toggle('hidden', !hasData);
		}
	}

	function renderIncomeVsExpense(chartData = {}) {
		if (!ChartLib) {
			return;
		}

		const dataPoints = Array.isArray(chartData.data) ? chartData.data : [];
		const labels = Array.isArray(chartData.labels) ? chartData.labels : ['Income', 'Expense'];
		const hasValues = Boolean(chartData.hasValues && dataPoints.some((value) => value > 0));

		toggleEmptyState('income-vs-expense', hasValues, 'incomeVsExpenseChart');

		if (!hasValues) {
			destroyChart('incomeVsExpense');
			return;
		}

		const canvas = document.getElementById('incomeVsExpenseChart');
		if (!canvas) {
			return;
		}

		destroyChart('incomeVsExpense');
		chartInstances.incomeVsExpense = new ChartLib(canvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						data: dataPoints,
						backgroundColor: ['#4caf50', '#f44336'],
						borderWidth: 0,
					},
				],
			},
			options: {
				plugins: {
					legend: {
						position: 'bottom',
					},
				},
			},
		});
	}

	function renderSavingsTrend(chartData = {}) {
		if (!ChartLib) {
			return;
		}

		const hasValues = Boolean(
			chartData.hasValues && Array.isArray(chartData.labels) && chartData.labels.length,
		);
		toggleEmptyState('savings-trend', hasValues, 'savingsTrendChart');

		if (!hasValues) {
			destroyChart('savingsTrend');
			return;
		}

		const canvas = document.getElementById('savingsTrendChart');
		if (!canvas) {
			return;
		}

		destroyChart('savingsTrend');
		chartInstances.savingsTrend = new ChartLib(canvas, {
			type: 'line',
			data: {
				labels: chartData.labels,
				datasets: [
					{
						label: 'Income',
						data: chartData.income || [],
						borderColor: '#4caf50',
						backgroundColor: 'rgba(76, 175, 80, 0.15)',
						tension: 0.3,
						fill: false,
					},
					{
						label: 'Expense',
						data: chartData.expense || [],
						borderColor: '#f44336',
						backgroundColor: 'rgba(244, 67, 54, 0.15)',
						tension: 0.3,
						fill: false,
					},
					{
						label: 'Savings',
						data: chartData.savings || [],
						borderColor: '#2196f3',
						backgroundColor: 'rgba(33, 150, 243, 0.15)',
						tension: 0.3,
						fill: false,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
					},
					tooltip: {
						callbacks: {
							label(context) {
								const value = Number(context.raw || 0);
								return `${context.dataset.label}: ${formatCurrency(value)}`;
							},
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback(value) {
								return `Rs ${Number(value).toFixed(0)}`;
							},
						},
					},
				},
			},
		});
	}

	function renderPieChart(key, canvasId, emptyKey, chartData = {}) {
		if (!ChartLib) {
			return;
		}

		const labels = Array.isArray(chartData.labels) ? chartData.labels : [];
		const dataPoints = Array.isArray(chartData.data) ? chartData.data : [];
		const hasValues = Boolean(chartData.hasValues && dataPoints.some((value) => value > 0));

		toggleEmptyState(emptyKey, hasValues, canvasId);

		if (!hasValues) {
			destroyChart(key);
			return;
		}

		const canvas = document.getElementById(canvasId);
		if (!canvas) {
			return;
		}

		destroyChart(key);
		chartInstances[key] = new ChartLib(canvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						data: dataPoints,
						backgroundColor: labels.map((_, index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length]),
						borderWidth: 0,
					},
				],
			},
			options: {
				plugins: {
					legend: {
						position: 'bottom',
					},
				},
			},
		});
	}

	function updateDashboard(analytics) {
		if (!analytics) {
			return;
		}

		const totals = analytics.totals || {};
		const charts = analytics.charts || {};

		// Only update metrics if they exist on the page (dashboard page)
		if (document.querySelector('[data-metric="income"]')) {
			setMetric('income', totals.income);
			setMetric('expense', totals.expense);
			setMetric('savings', totals.savings);
			setMetric('savingsRate', totals.savingsRate, formatPercentage);
		}

		// Only render charts if canvas elements exist (reports page)
		if (document.getElementById('incomeVsExpenseChart')) {
			renderIncomeVsExpense(charts.incomeVsExpense || {});
		}
		if (document.getElementById('savingsTrendChart')) {
			renderSavingsTrend(charts.savingsTrend || {});
		}
		if (document.getElementById('expenseCategoryChart')) {
			renderPieChart('expenseByCategory', 'expenseCategoryChart', 'expense-categories', charts.expenseByCategory || {});
		}
		if (document.getElementById('incomeSourceChart')) {
			renderPieChart('incomeBySource', 'incomeSourceChart', 'income-sources', charts.incomeBySource || {});
		}
	}

	async function fetchAnalytics() {
		try {
			const response = await fetch(analyticsEndpoint, { headers: { Accept: 'application/json' } });
			if (!response.ok) {
				throw new Error(`Analytics request failed with status ${response.status}`);
			}

			const analytics = await response.json();
			updateDashboard(analytics || createEmptyAnalytics());
		} catch (error) {
			console.error('Failed to refresh analytics', error);
		}
	}

	function createFormController(form) {
		if (!form) {
			return null;
		}

		const type = form.dataset.form;
		const section = form.closest('[data-section]');
		const header = section ? section.querySelector('.form-header') : null;
		const titleElement = header ? header.querySelector(`[data-role="form-title"][data-form="${type}"]`) : null;
		const cancelButton = header ? header.querySelector(`[data-role="cancel-edit"][data-form="${type}"]`) : null;
		const submitButton = form.querySelector(`[data-role="submit"][data-form="${type}"]`);
		const methodInput = form.querySelector('[data-field="method"]');
		const amountField = form.querySelector('[data-field="amount"]');
		const dateField = form.querySelector('[data-field="date"]');
		const categoryField = form.querySelector('[data-field="category"]');
		const descriptionField = form.querySelector('[data-field="description"]');
		const defaultAction = form.dataset.defaultAction || '/transactions';
		const defaultDate = form.dataset.defaultDate || new Date().toISOString().slice(0, 10);
		const createTitle = titleElement ? titleElement.dataset.createTitle : 'Add';
		const editTitle = titleElement ? titleElement.dataset.editTitle : 'Update';
		const createLabel = submitButton ? submitButton.dataset.createLabel : 'Add';
		const editLabel = submitButton ? submitButton.dataset.editLabel : 'Update';

		const state = {
			mode: form.dataset.mode === 'edit' ? 'edit' : 'create',
			transactionId: form.dataset.transactionId || '',
		};

		function clearValidity() {
			[amountField, dateField, categoryField].forEach((field) => {
				if (field) {
					field.setCustomValidity('');
				}
			});
		}

		function setFields(values = {}) {
			if (amountField) {
				amountField.value = values.amount !== undefined ? values.amount : '';
			}
			if (dateField) {
				dateField.value = values.date || defaultDate;
			}
			if (categoryField) {
				categoryField.value = values.category || '';
			}
			if (descriptionField) {
				descriptionField.value = values.description || '';
			}
		}

		function applyMode(mode, payload = {}, options = {}) {
			state.mode = mode;
			state.transactionId = payload.transactionId || '';
			form.dataset.mode = mode;
			form.dataset.transactionId = state.transactionId;

			if (mode === 'edit' && state.transactionId) {
				form.action = `${defaultAction}/${state.transactionId}`;
				if (methodInput) {
					methodInput.value = 'PUT';
				}
				if (titleElement) {
					titleElement.textContent = editTitle;
				}
				if (submitButton) {
					submitButton.textContent = editLabel;
				}
				if (cancelButton) {
					cancelButton.classList.remove('hidden');
				}

				if (payload.values && !options.preserveValues) {
					setFields(payload.values);
				}
			} else {
				form.action = defaultAction;
				if (methodInput) {
					methodInput.value = '';
				}
				if (titleElement) {
					titleElement.textContent = createTitle;
				}
				if (submitButton) {
					submitButton.textContent = createLabel;
				}
				if (cancelButton) {
					cancelButton.classList.add('hidden');
				}

				if (!options.preserveValues) {
					setFields({ amount: '', date: defaultDate, category: '', description: '' });
				}
			}

			clearValidity();
		}

		form.addEventListener('submit', (event) => {
			clearValidity();

			const amountValue = Number.parseFloat(amountField ? amountField.value : '0');
			if (!Number.isFinite(amountValue) || amountValue <= 0) {
				if (amountField) {
					amountField.setCustomValidity('Enter an amount greater than zero.');
					event.preventDefault();
					amountField.reportValidity();
				}
				return;
			}

			if (!dateField || !dateField.value) {
				if (dateField) {
					dateField.setCustomValidity('Select a date.');
					event.preventDefault();
					dateField.reportValidity();
				}
				return;
			}

			if (!categoryField || !categoryField.value.trim()) {
				if (categoryField) {
					const message = type === 'income' ? 'Enter an income source.' : 'Enter a category.';
					categoryField.setCustomValidity(message);
					event.preventDefault();
					categoryField.reportValidity();
				}
				return;
			}

			categoryField.value = categoryField.value.trim();
			if (descriptionField && descriptionField.value) {
				descriptionField.value = descriptionField.value.trim();
			}
		});

		if (cancelButton) {
			cancelButton.addEventListener('click', () => {
				applyMode('create');
			});
		}

		if (dateField && !dateField.value) {
			dateField.value = defaultDate;
		}

		applyMode(state.mode, { transactionId: state.transactionId }, { preserveValues: true });

		return {
			type,
			setEditMode(transaction) {
				applyMode(
					'edit',
					{
						transactionId: transaction.id,
						values: {
							amount: transaction.amount,
							date: transaction.date,
							category: transaction.category,
							description: transaction.description || '',
						},
					},
					{ preserveValues: false },
				);
				if (amountField) {
					amountField.focus();
				}
			},
			setCreateMode() {
				applyMode('create');
			},
		};
	}

	function initForms() {
		const controllers = {};
		document.querySelectorAll('form[data-form]').forEach((form) => {
			const controller = createFormController(form);
			if (controller) {
				controllers[controller.type] = controller;
			}
		});
		return controllers;
	}

	function initEditButtons(controllers) {
		document.querySelectorAll('.edit-transaction').forEach((button) => {
			button.addEventListener('click', () => {
				const type = button.dataset.type;
				const controller = controllers[type];
				if (!controller) {
					return;
				}

				const transaction = {
					id: button.dataset.id,
					amount: button.dataset.amount,
					date: button.dataset.date,
					type,
					category: button.dataset.category,
					description: button.dataset.description,
				};

				controller.setEditMode(transaction);

				const otherType = type === 'income' ? 'expense' : 'income';
				if (controllers[otherType]) {
					controllers[otherType].setCreateMode();
				}
			});
		});
	}

	function createLimitFormController(form) {
		if (!form) {
			return null;
		}

		const state = {
			mode: form.dataset.mode === 'edit' ? 'edit' : 'create',
		};

		const categoryField = form.querySelector('[data-field="category"]');
		const limitField = form.querySelector('[data-field="limit"]');
		const idField = form.querySelector('[data-field="limitId"]');
		const submitButton = form.querySelector('[data-role="submit-limit"]');
		const cancelButton = form.querySelector('[data-role="cancel-limit-edit"]');
		const labels = {
			create: submitButton ? submitButton.dataset.createLabel || 'Save Limit' : 'Save Limit',
			edit: submitButton ? submitButton.dataset.editLabel || 'Update Limit' : 'Update Limit',
		};

		function formatLimitValue(value) {
			if (value === '' || value === null || value === undefined) {
				return '';
			}
			const numeric = Number.parseFloat(value);
			return Number.isFinite(numeric) ? numeric.toFixed(2) : '';
		}

		function clearValidity() {
			if (categoryField) {
				categoryField.setCustomValidity('');
			}
			if (limitField) {
				limitField.setCustomValidity('');
			}
		}

		function setMode(mode, values = {}) {
			state.mode = mode;
			form.dataset.mode = mode;
			clearValidity();

			if (mode === 'edit' && values.limitId) {
				if (idField) {
					idField.value = values.limitId;
				}
				if (categoryField) {
					categoryField.value = values.category || '';
				}
				if (limitField) {
					limitField.value = formatLimitValue(values.limit);
				}
				if (submitButton) {
					submitButton.textContent = labels.edit;
				}
				if (cancelButton) {
					cancelButton.classList.remove('hidden');
				}
			} else {
				if (idField) {
					idField.value = '';
				}
				if (categoryField) {
					categoryField.value = '';
				}
				if (limitField) {
					limitField.value = '';
				}
				if (submitButton) {
					submitButton.textContent = labels.create;
				}
				if (cancelButton) {
					cancelButton.classList.add('hidden');
				}
			}
		}

		setMode(state.mode, {
			limitId: idField ? idField.value : '',
			category: categoryField ? categoryField.value : '',
			limit: limitField ? limitField.value : '',
		});

		form.addEventListener('submit', (event) => {
			clearValidity();

			if (categoryField) {
				const trimmed = categoryField.value.trim();
				if (!trimmed) {
					categoryField.setCustomValidity('Enter a category.');
					categoryField.reportValidity();
					event.preventDefault();
					return;
				}
				categoryField.value = trimmed;
			}

			if (limitField) {
				const numeric = Number.parseFloat(limitField.value);
				if (!Number.isFinite(numeric) || numeric <= 0) {
					limitField.setCustomValidity('Enter a limit greater than zero.');
					limitField.reportValidity();
					event.preventDefault();
					return;
				}
				limitField.value = numeric.toFixed(2);
			}
		});

		if (cancelButton) {
			cancelButton.addEventListener('click', () => {
				setMode('create');
				if (categoryField) {
					categoryField.focus();
				}
			});
		}

		return {
			setEditMode(values) {
				setMode('edit', values);
				if (categoryField) {
					categoryField.focus();
				}
			},
			setCreateMode() {
				setMode('create');
			},
		};
	}

	function initLimitEditButtons(controller) {
		if (!controller) {
			return;
		}

		document.querySelectorAll('.edit-limit').forEach((button) => {
			button.addEventListener('click', () => {
				controller.setEditMode({
					limitId: button.dataset.limitId,
					category: button.dataset.category || '',
					limit: button.dataset.limit,
				});
			});
		});
	}

	const embeddedAnalytics = parseEmbeddedAnalytics();

	// Only update dashboard and fetch analytics if we have analytics data or are on a page with charts
	const hasCharts = document.getElementById('incomeVsExpenseChart') !== null;
	if (embeddedAnalytics || hasCharts) {
		updateDashboard(embeddedAnalytics || createEmptyAnalytics());

		// Only fetch fresh analytics on dashboard page (not reports page)
		const isDashboardPage = document.querySelector('[data-limit-form]') !== null;
		if (isDashboardPage) {
			fetchAnalytics();
		}
	}

	const formControllers = initForms();
	initEditButtons(formControllers);
	const limitForm = document.querySelector('[data-limit-form]');
	const limitController = createLimitFormController(limitForm);
	initLimitEditButtons(limitController);
});
