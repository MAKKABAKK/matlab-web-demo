function filteredSignal = signal_denoising_moving_average(inputSignal, windowSize)
%SIGNAL_DENOISING_MOVING_AVERAGE 使用居中移动平均平滑信号。

    validateattributes(inputSignal, {'numeric'}, ...
        {'vector', 'real', 'finite', 'nonempty'});
    validateattributes(windowSize, {'numeric'}, ...
        {'scalar', 'real', 'finite', 'integer', 'positive'});

    if windowSize > numel(inputSignal)
        error('SignalDenoising:WindowTooLarge', ...
            'Window size cannot exceed the signal length.');
    end

    wasRow = isrow(inputSignal);
    inputColumn = inputSignal(:);
    kernel = ones(windowSize, 1) / windowSize;
    filteredSignal = conv(inputColumn, kernel, 'same');

    if wasRow
        filteredSignal = filteredSignal.';
    end
end
