function data = generate_data(numPoints)
%GENERATE_DATA 建立可重现的合成客流量与单步预测。

    if nargin < 1
        numPoints = 168;
    end
    if ~isscalar(numPoints) || numPoints < 24 || fix(numPoints) ~= numPoints
        error('Demo:InvalidPointCount', 'numPoints must be an integer of at least 24.');
    end

    rng(42, 'twister');
    time = (1:numPoints)';
    trend = 1.5 * time;
    dailyPattern = 150 * sin(2 * pi * time / 24 - pi / 2);
    weeklyPattern = 45 * sin(2 * pi * time / 168);
    randomNoise = 48 * randn(numPoints, 1);

    passengerFlow = 1000 + trend + dailyPattern + weeklyPattern + randomNoise;
    passengerFlow = max(passengerFlow, 0);

    % 每个预测点只使用过去资料，避免把未来值泄漏到基准模型。
    windowSize = 12;
    forecast = nan(numPoints, 1);
    for index = (windowSize + 1):numPoints
        recentValue = passengerFlow(index - 1);
        rollingMean = mean(passengerFlow(index - windowSize:index - 1));
        forecast(index) = 0.7 * recentValue + 0.3 * rollingMean;
    end

    data = struct( ...
        'time', time, ...
        'passengerFlow', passengerFlow, ...
        'forecast', forecast, ...
        'windowSize', windowSize);
end
