function main()
%MAIN 发布客流量预测代码案例。
%   可从任意 MATLAB 当前目录调用；输出路径由本文件位置推导。

    mainFile = [mfilename('fullpath'), '.m'];
    matlabDir = fileparts(mainFile);

    originalPath = path;
    pathCleanup = onCleanup(@() path(originalPath));
    addpath(matlabDir, '-begin');

    project = struct( ...
        'id', 'passenger-flow', ...
        'title', 'Passenger Flow Forecasting Demo', ...
        'sourceDir', matlabDir, ...
        'sourceFiles', {{'main.m', 'generate_data.m', 'generate_plots.m'}}, ...
        'buildFunction', @buildPassengerFlow);
    publish_project(project);
end

function bundle = buildPassengerFlow()
%BUILDPASSENGERFLOW 计算指标并建立等待发布的图表。
    demoData = generate_data(168);
    actual = demoData.passengerFlow;
    forecast = demoData.forecast;
    valid = ~isnan(forecast);
    errors = actual(valid) - forecast(valid);

    mae = mean(abs(errors));
    rmse = sqrt(mean(errors .^ 2));
    ssResidual = sum(errors .^ 2);
    ssTotal = sum((actual(valid) - mean(actual(valid))) .^ 2);
    rSquared = 1 - (ssResidual / ssTotal);

    % 虚拟模型分数与基准误差保持一致，便于说明网页发布流程。
    modelNames = {'ARIMA', 'Random Forest', 'LSTM'};
    modelRmse = [rmse * 1.14, rmse, rmse * 0.91];

    results = struct();
    results.metrics = struct( ...
        'MAE', round(mae, 2), ...
        'RMSE', round(rmse, 2), ...
        'R2', round(rSquared, 3));
    results.models = struct( ...
        'name', modelNames, ...
        'rmse', num2cell(round(modelRmse, 2)));

    bundle = struct( ...
        'results', results, ...
        'figures', generate_plots(demoData, modelNames, modelRmse));
end
