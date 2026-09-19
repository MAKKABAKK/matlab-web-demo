function figures = signal_denoising_create_figures( ...
    data, bestFiltered, windowResults, bestIndex)
%SIGNAL_DENOISING_CREATE_FIGURES 创建四张信号去噪案例图表。

    created = cell(0, 1);
    try
        componentsFigure = newFigure([100, 100, 1180, 780]);
        created{end + 1} = componentsFigure;
        drawSignalComponents(componentsFigure, data);

        comparisonFigure = newFigure([100, 100, 1180, 720]);
        created{end + 1} = comparisonFigure;
        drawDenoisingComparison( ...
            comparisonFigure, data, bestFiltered, ...
            windowResults(bestIndex).window);

        spectrumFigure = newFigure([100, 100, 1180, 620]);
        created{end + 1} = spectrumFigure;
        drawFrequencySpectrum(spectrumFigure, data, bestFiltered);

        tradeoffFigure = newFigure([100, 100, 1180, 720]);
        created{end + 1} = tradeoffFigure;
        drawWindowTradeoff(tradeoffFigure, windowResults, bestIndex);
    catch exception
        closeCreatedFigures(created);
        rethrow(exception);
    end

    figures = repmat(struct('file', '', 'handle', []), 4, 1);
    figures(1).file = 'signal_components.png';
    figures(1).handle = componentsFigure;
    figures(2).file = 'denoising_comparison.png';
    figures(2).handle = comparisonFigure;
    figures(3).file = 'frequency_spectrum.png';
    figures(3).handle = spectrumFigure;
    figures(4).file = 'window_tradeoff.png';
    figures(4).handle = tradeoffFigure;
end

function fig = newFigure(position)
%NEWFIGURE 创建适合静态发布的隐藏图窗。
    fig = figure('Visible', 'off', 'Color', [1, 1, 1], ...
        'Position', position, ...
        'NumberTitle', 'off');
end

function drawSignalComponents(fig, data)
%DRAWSIGNALCOMPONENTS 展示真值、干扰与观测信号。
    figure(fig);
    timeColor = [0.08, 0.31, 0.77];
    noiseColor = [0.82, 0.32, 0.25];
    observedColor = [0.20, 0.26, 0.35];

    ax1 = subplot(3, 1, 1);
    plot(data.time, data.cleanSignal, 'Color', timeColor, 'LineWidth', 1.35);
    title('Clean reference signal');
    ylabel('Amplitude');
    style_demo_axes(ax1);

    ax2 = subplot(3, 1, 2);
    plot(data.time, data.disturbance, 'Color', noiseColor, 'LineWidth', 0.8);
    title('Gaussian noise and impulse interference');
    ylabel('Amplitude');
    style_demo_axes(ax2);

    ax3 = subplot(3, 1, 3);
    plot(data.time, data.observedSignal, ...
        'Color', observedColor, 'LineWidth', 0.8);
    title('Observed signal');
    xlabel('Time (s)');
    ylabel('Amplitude');
    style_demo_axes(ax3);

    linkaxes([ax1, ax2, ax3], 'x');
    xlim(ax3, [data.time(1), data.time(end)]);
end

function drawDenoisingComparison(fig, data, filteredSignal, bestWindow)
%DRAWDENOISINGCOMPARISON 对比完整区间与局部细节。
    figure(fig);
    cleanColor = [0.08, 0.31, 0.77];
    observedColor = [0.63, 0.66, 0.71];
    filteredColor = [0.00, 0.55, 0.49];

    ax1 = subplot(2, 1, 1);
    plot(data.time, data.observedSignal, ...
        'Color', observedColor, 'LineWidth', 0.65);
    hold on;
    plot(data.time, data.cleanSignal, 'Color', cleanColor, 'LineWidth', 1.0);
    plot(data.time, filteredSignal, ...
        'Color', filteredColor, 'LineWidth', 1.45);
    hold off;
    title(sprintf('Full signal comparison (best window = %d)', bestWindow));
    ylabel('Amplitude');
    comparisonLegend(ax1);
    style_demo_axes(ax1);

    ax2 = subplot(2, 1, 2);
    plot(data.time, data.observedSignal, ...
        'Color', observedColor, 'LineWidth', 0.75);
    hold on;
    plot(data.time, data.cleanSignal, 'Color', cleanColor, 'LineWidth', 1.2);
    plot(data.time, filteredSignal, ...
        'Color', filteredColor, 'LineWidth', 1.6);
    hold off;
    title('Two-second detail');
    xlabel('Time (s)');
    ylabel('Amplitude');
    xlim([0, min(2, data.time(end))]);
    style_demo_axes(ax2);
end

function comparisonLegend(ax)
%COMPARISONLEGEND 添加一致的对比图例。
    legendHandle = legend(ax, ...
        {'Observed', 'Clean reference', 'Moving average'}, ...
        'Location', 'best');
    set(legendHandle, 'Color', [1, 1, 1], ...
        'TextColor', [0.20, 0.26, 0.35], 'EdgeColor', 'none');
end

function drawFrequencySpectrum(fig, data, filteredSignal)
%DRAWFREQUENCYSPECTRUM 比较滤波前后的单边振幅谱。
    figure(fig);
    [frequency, observedAmplitude] = signal_denoising_compute_spectrum( ...
        data.observedSignal, data.sampleRate);
    [~, filteredAmplitude] = signal_denoising_compute_spectrum( ...
        filteredSignal, data.sampleRate);

    ax = axes('Parent', fig);
    semilogy(ax, frequency, max(observedAmplitude, eps), ...
        'Color', [0.63, 0.66, 0.71], 'LineWidth', 1.0);
    hold(ax, 'on');
    semilogy(ax, frequency, max(filteredAmplitude, eps), ...
        'Color', [0.00, 0.55, 0.49], 'LineWidth', 1.5);
    hold(ax, 'off');
    title(ax, 'Single-sided amplitude spectrum');
    xlabel(ax, 'Frequency (Hz)');
    ylabel(ax, 'Amplitude');
    xlim(ax, [0, min(50, data.sampleRate / 2)]);
    legendHandle = legend(ax, {'Observed', 'Filtered'}, 'Location', 'best');
    set(legendHandle, 'Color', [1, 1, 1], ...
        'TextColor', [0.20, 0.26, 0.35], 'EdgeColor', 'none');
    style_demo_axes(ax);
end

function drawWindowTradeoff(fig, windowResults, bestIndex)
%DRAWWINDOWTRADEOFF 展示平滑窗口的误差与信噪比权衡。
    figure(fig);
    windows = [windowResults.window];
    rmseValues = [windowResults.rmse];
    snrValues = [windowResults.outputSNR];
    bestWindow = windows(bestIndex);

    ax1 = subplot(2, 1, 1);
    plot(windows, rmseValues, '-o', 'Color', [0.08, 0.31, 0.77], ...
        'MarkerFaceColor', [0.08, 0.31, 0.77], 'LineWidth', 1.5);
    hold on;
    plot(bestWindow, rmseValues(bestIndex), 'o', ...
        'Color', [0.85, 0.35, 0.12], ...
        'MarkerFaceColor', [0.85, 0.35, 0.12], 'MarkerSize', 9);
    hold off;
    title('Window size versus RMSE');
    xlabel('Moving-average window (samples)');
    ylabel('RMSE');
    style_demo_axes(ax1);

    ax2 = subplot(2, 1, 2);
    plot(windows, snrValues, '-o', 'Color', [0.00, 0.55, 0.49], ...
        'MarkerFaceColor', [0.00, 0.55, 0.49], 'LineWidth', 1.5);
    hold on;
    plot(bestWindow, snrValues(bestIndex), 'o', ...
        'Color', [0.85, 0.35, 0.12], ...
        'MarkerFaceColor', [0.85, 0.35, 0.12], 'MarkerSize', 9);
    hold off;
    title('Window size versus output SNR');
    xlabel('Moving-average window (samples)');
    ylabel('Output SNR (dB)');
    style_demo_axes(ax2);
end

function closeCreatedFigures(figures)
%CLOSECREATEDFIGURES 构图失败时清理已创建的图窗。
    for index = 1:numel(figures)
        if ishghandle(figures{index})
            close(figures{index});
        end
    end
end
