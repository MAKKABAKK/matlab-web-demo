function [frequency, amplitude] = signal_denoising_compute_spectrum(inputSignal, sampleRate)
%SIGNAL_DENOISING_COMPUTE_SPECTRUM 计算正确归一化的单边振幅谱。

    validateattributes(inputSignal, {'numeric'}, ...
        {'vector', 'real', 'finite', 'nonempty'});
    validateattributes(sampleRate, {'numeric'}, ...
        {'scalar', 'real', 'finite', 'positive'});

    signalColumn = inputSignal(:);
    sampleCount = numel(signalColumn);
    if sampleCount < 2
        error('SignalDenoising:TooFewSpectrumSamples', ...
            'Spectrum calculation requires at least two samples.');
    end

    signalColumn = signalColumn - mean(signalColumn);

    % 手工构造 Hann 窗，避免依赖 Signal Processing Toolbox。
    sampleIndex = (0:(sampleCount - 1))';
    taper = 0.5 - 0.5 * cos(2 * pi * sampleIndex / (sampleCount - 1));
    coherentGain = sum(taper) / sampleCount;
    transform = fft(signalColumn .* taper);
    twoSided = abs(transform) / (sampleCount * coherentGain);

    lastBin = floor(sampleCount / 2) + 1;
    amplitude = twoSided(1:lastBin);
    if mod(sampleCount, 2) == 0
        amplitude(2:(end - 1)) = 2 * amplitude(2:(end - 1));
    else
        amplitude(2:end) = 2 * amplitude(2:end);
    end
    frequency = (0:(lastBin - 1))' * sampleRate / sampleCount;
end
