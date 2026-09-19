function figures = generate_plots(data, modelNames, modelRmse)
%GENERATE_PLOTS 建立客流量预测案例所需的四个图窗。
%   图窗由共享发布器统一导出并关闭。

    figureColor = [1 1 1];
    actualColor = [0.08 0.31 0.77];
    forecastColor = [0.00 0.65 0.63];
    figures = repmat(struct('file', '', 'handle', []), 1, 4);

    fig = createFigure(figureColor);
    plot(data.time, data.passengerFlow, 'Color', actualColor, 'LineWidth', 1.6);
    title('Passenger Flow Over Time');
    xlabel('Time');
    ylabel('Passenger Flow');
    style_demo_axes(gca);
    figures(1) = struct('file', 'passenger_flow.png', 'handle', fig);

    fig = createFigure(figureColor);
    plot(data.time, data.passengerFlow, 'Color', actualColor, 'LineWidth', 1.4);
    hold on;
    plot(data.time, data.forecast, '--', 'Color', forecastColor, 'LineWidth', 2.0);
    hold off;
    title('Passenger Flow Forecast');
    xlabel('Time');
    ylabel('Passenger Flow');
    legendHandle = legend({'Actual Passenger Flow', 'Forecast Passenger Flow'}, ...
        'Location', 'best');
    set(legendHandle, 'Color', [1 1 1], 'TextColor', [0.20 0.26 0.35], ...
        'EdgeColor', 'none');
    style_demo_axes(gca);
    figures(2) = struct('file', 'forecast.png', 'handle', fig);

    fig = createFigure(figureColor);
    bars = bar(modelRmse, 0.62, 'FaceColor', 'flat');
    bars.CData = [0.08 0.31 0.77; 0.25 0.50 0.92; 0.00 0.65 0.63];
    set(gca, 'XTick', 1:numel(modelNames), 'XTickLabel', modelNames);
    title('Model Performance Comparison');
    xlabel('Model');
    ylabel('RMSE');
    style_demo_axes(gca);
    figures(3) = struct('file', 'model_comparison.png', 'handle', fig);

    valid = ~isnan(data.forecast);
    errors = data.passengerFlow(valid) - data.forecast(valid);
    fig = createFigure(figureColor);
    histogram(errors, 18, 'FaceColor', actualColor, 'EdgeColor', 'white');
    xline(0, '--', 'Zero error', 'Color', forecastColor, 'LineWidth', 1.5);
    title('Forecast Error Distribution');
    xlabel('Actual - Forecast');
    ylabel('Frequency');
    style_demo_axes(gca);
    figures(4) = struct('file', 'error_distribution.png', 'handle', fig);
end

function fig = createFigure(figureColor)
%CREATEFIGURE 建立一致尺寸且不显示的图窗。
    fig = figure('Visible', 'off', 'Color', figureColor, ...
        'Position', [100 100 1100 620]);
end
