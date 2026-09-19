function figures = create_queue_figures(simulation, scenarios, warmupCount)
%CREATE_QUEUE_FIGURES 建立四张排队仿真案例图。

    actualColor = [0.08 0.31 0.77];
    accentColor = [0.00 0.65 0.63];
    warningColor = [0.91 0.45 0.12];
    figurePosition = [100 100 1100 620];
    figures = repmat(struct('file', '', 'handle', []), 1, 4);

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    sampleCount = min(160, numel(simulation.waiting));
    customer = (1:sampleCount)';
    plot(customer, simulation.waiting(1:sampleCount), ...
        'Color', actualColor, 'LineWidth', 1.4);
    hold on;
    stairs(customer, simulation.queueAtArrival(1:sampleCount), ...
        'Color', accentColor, 'LineWidth', 1.2);
    hold off;
    title('Queue Timeline');
    xlabel('Customer'); ylabel('Wait / Queue length');
    legend({'Waiting time', 'Queue at arrival'}, 'Location', 'best');
    style_demo_axes(gca);
    figures(1) = struct('file', 'queue_timeline.png', 'handle', fig);

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    waiting = simulation.waiting(warmupCount + 1:end);
    histogram(waiting, 24, 'FaceColor', actualColor, 'EdgeColor', 'white');
    title('Waiting Time Distribution');
    xlabel('Waiting time'); ylabel('Customers');
    style_demo_axes(gca);
    figures(2) = struct('file', 'waiting_distribution.png', 'handle', fig);

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    labels = {'Low load', 'Balanced load', 'High load'};
    subplot(1, 2, 1);
    bar([scenarios.meanWait], 0.64, 'FaceColor', actualColor);
    set(gca, 'XTick', 1:numel(labels), 'XTickLabel', labels);
    title('Mean Waiting Time'); ylabel('Time');
    style_demo_axes(gca);
    subplot(1, 2, 2);
    bar(100 * [scenarios.utilization], 0.64, 'FaceColor', accentColor);
    set(gca, 'XTick', 1:numel(labels), 'XTickLabel', labels);
    title('Server Utilization'); ylabel('Percent');
    style_demo_axes(gca);
    figures(3) = struct('file', 'scenario_comparison.png', 'handle', fig);

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    runningAverage = cumsum(waiting) ./ (1:numel(waiting))';
    plot(1:numel(waiting), runningAverage, ...
        'Color', warningColor, 'LineWidth', 1.7);
    hold on;
    plot([1 numel(waiting)], [mean(waiting) mean(waiting)], '--', ...
        'Color', accentColor, 'LineWidth', 1.4);
    hold off;
    title('Running Average Waiting Time');
    xlabel('Observed customers after warm-up'); ylabel('Average wait');
    legend({'Running average', 'Final average'}, 'Location', 'best');
    style_demo_axes(gca);
    figures(4) = struct('file', 'running_average.png', 'handle', fig);
end
