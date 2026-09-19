function bundle = build_queue_simulation()
%BUILD_QUEUE_SIMULATION 构建可复现的三种负载情景。

    % 结果使用语言中立的稳定值；网页依 manifest 映射显示语言。
    scenarioNames = {'low', 'balanced', 'high'};
    arrivalRates = [0.55, 0.80, 0.95];
    serviceRate = 1.0;
    numCustomers = 900;
    warmupCount = 100;
    simulations = cell(1, numel(arrivalRates));
    summaries = cell(1, numel(arrivalRates));
    scenarios = repmat(struct( ...
        'name', '', ...
        'arrivalRate', 0, ...
        'loadFactor', 0, ...
        'meanWait', 0, ...
        'p95Wait', 0, ...
        'utilization', 0), 1, numel(arrivalRates));

    for index = 1:numel(arrivalRates)
        simulations{index} = simulate_queue_demo( ...
            numCustomers, arrivalRates(index), serviceRate, 620 + index);
        summaries{index} = summarize_queue_demo(simulations{index}, warmupCount);
        scenarios(index).name = scenarioNames{index};
        scenarios(index).arrivalRate = round(arrivalRates(index), 2);
        scenarios(index).loadFactor = round(arrivalRates(index) / serviceRate, 2);
        scenarios(index).meanWait = round(summaries{index}.meanWait, 3);
        scenarios(index).p95Wait = round(summaries{index}.p95Wait, 3);
        scenarios(index).utilization = round(summaries{index}.utilization, 3);
    end

    baselineIndex = 2;
    baselineSummary = summaries{baselineIndex};
    metrics = struct( ...
        'meanWait', round(baselineSummary.meanWait, 3), ...
        'p95Wait', round(baselineSummary.p95Wait, 3), ...
        'utilization', round(baselineSummary.utilization, 3), ...
        'probabilityOfWait', round(baselineSummary.probabilityOfWait, 3), ...
        'maxQueue', baselineSummary.maxQueue);

    bundle = struct();
    bundle.results = struct('metrics', metrics, 'scenarios', scenarios);
    bundle.figures = create_queue_figures( ...
        simulations{baselineIndex}, scenarios, warmupCount);
end
