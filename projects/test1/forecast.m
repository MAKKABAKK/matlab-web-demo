function prediction = forecast(trainData, horizon, lag)
%FORECAST Autoregressive passenger-flow forecast without extra toolboxes.
%   prediction = forecast(trainData, horizon, lag) fits a least-squares
%   autoregressive model using the previous LAG observations and predicts
%   HORIZON future values recursively.

    trainData = trainData(:);

    if nargin < 3
        lag = 24;
    end

    if numel(trainData) <= lag
        error('Training data must contain more observations than lag.');
    end

    X = zeros(numel(trainData) - lag, lag + 1);
    y = zeros(numel(trainData) - lag, 1);

    for i = lag + 1:numel(trainData)
        row = i - lag;
        X(row, :) = [1, trainData(i-lag:i-1)'];
        y(row) = trainData(i);
    end

    beta = X \ y;
    history = trainData;
    prediction = zeros(horizon, 1);

    for h = 1:horizon
        features = [1, history(end-lag+1:end)'];
        prediction(h) = features * beta;
        history(end+1, 1) = prediction(h); %#ok<AGROW>
    end
end
