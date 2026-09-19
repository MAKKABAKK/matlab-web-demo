function data = signal_denoising_generate_signal(settings)
%SIGNAL_DENOISING_GENERATE_SIGNAL 生成可复现的合成信号与噪声。

    validateattributes(settings.sampleRate, {'numeric'}, ...
        {'scalar', 'real', 'finite', 'positive'});
    validateattributes(settings.durationSeconds, {'numeric'}, ...
        {'scalar', 'real', 'finite', 'positive'});

    sampleCount = round(settings.sampleRate * settings.durationSeconds);
    if sampleCount < 2
        error('SignalDenoising:TooFewSamples', ...
            'Signal generation requires at least two samples.');
    end

    rng(settings.randomSeed, 'twister');
    time = (0:(sampleCount - 1))' / settings.sampleRate;

    % 三个频率分量构成已知真值，便于量化滤波误差。
    cleanSignal = ...
        0.90 * sin(2 * pi * 5.0 * time) + ...
        0.45 * sin(2 * pi * 18.0 * time + pi / 5) + ...
        0.15 * sin(2 * pi * 0.35 * time);

    gaussianNoise = settings.noiseStandardDeviation * randn(sampleCount, 1);
    impulseNoise = zeros(sampleCount, 1);
    impulseCount = min(round(settings.impulseCount), sampleCount);
    impulseLocations = randperm(sampleCount, impulseCount);
    impulseMagnitudes = 2.0 + 1.1 * rand(impulseCount, 1);
    impulseSigns = ones(impulseCount, 1);
    impulseSigns(1:2:end) = -1;
    impulseNoise(impulseLocations) = impulseMagnitudes .* impulseSigns;

    disturbance = gaussianNoise + impulseNoise;
    observedSignal = cleanSignal + disturbance;

    data = struct();
    data.time = time;
    data.sampleRate = settings.sampleRate;
    data.cleanSignal = cleanSignal;
    data.gaussianNoise = gaussianNoise;
    data.impulseNoise = impulseNoise;
    data.disturbance = disturbance;
    data.observedSignal = observedSignal;
end
