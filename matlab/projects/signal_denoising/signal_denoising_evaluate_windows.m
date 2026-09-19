function [results, filteredSignals, bestIndex, evaluationMask] = ...
    signal_denoising_evaluate_windows(cleanSignal, observedSignal, ...
    windowSizes)
%SIGNAL_DENOISING_EVALUATE_WINDOWS 公平比较不同移动平均窗口。

    validateattributes(cleanSignal, {'numeric'}, ...
        {'vector', 'real', 'finite', 'nonempty'});
    validateattributes(observedSignal, {'numeric'}, ...
        {'vector', 'real', 'finite', 'nonempty'});
    validateattributes(windowSizes, {'numeric'}, ...
        {'vector', 'real', 'finite', 'integer', 'positive', 'nonempty'});
    cleanColumn = cleanSignal(:);
    observedColumn = observedSignal(:);
    sampleCount = numel(cleanColumn);
    if numel(observedColumn) ~= sampleCount
        error('SignalDenoising:LengthMismatch', ...
            'Clean and observed signals must have the expected length.');
    end

    windowSizes = windowSizes(:)';
    if any(windowSizes > sampleCount)
        error('SignalDenoising:WindowTooLarge', ...
            'Every window must fit within the signal.');
    end
    if numel(unique(windowSizes)) ~= numel(windowSizes)
        error('SignalDenoising:DuplicateWindow', ...
            'Window sizes must be unique.');
    end

    % 所有窗口共用同一内部区间，排除卷积的零填充边缘。
    comparisonMargin = floor(max(windowSizes) / 2);
    if 2 * comparisonMargin >= sampleCount
        error('SignalDenoising:NoEvaluationRegion', ...
            'The largest window leaves no shared evaluation region.');
    end
    evaluationMask = false(sampleCount, 1);
    evaluationMask((comparisonMargin + 1):(sampleCount - comparisonMargin)) = true;

    windowCount = numel(windowSizes);
    filteredSignals = zeros(sampleCount, windowCount);
    results = repmat(struct('window', 0, 'rmse', 0, 'outputSNR', 0), ...
        windowCount, 1);
    reference = cleanColumn(evaluationMask);
    referenceEnergy = sum(reference .^ 2);

    for index = 1:windowCount
        filtered = signal_denoising_moving_average( ...
            observedColumn, windowSizes(index));
        filteredSignals(:, index) = filtered;
        errorValues = filtered(evaluationMask) - reference;

        results(index).window = windowSizes(index);
        results(index).rmse = sqrt(mean(errorValues .^ 2));
        results(index).outputSNR = 10 * log10( ...
            referenceEnergy / sum(errorValues .^ 2));
    end

    [~, bestIndex] = min([results.rmse]);
end
