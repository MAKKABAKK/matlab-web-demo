function summary = summarize_queue_demo(simulation, warmupCount)
%SUMMARIZE_QUEUE_DEMO 计算排队指标，不依赖 Statistics Toolbox。

    if nargin < 2
        warmupCount = 0;
    end
    firstIndex = min(max(warmupCount + 1, 1), numel(simulation.waiting));
    waiting = simulation.waiting(firstIndex:end);
    sortedWaiting = sort(waiting);
    percentileIndex = max(1, ceil(0.95 * numel(sortedWaiting)));

    summary = struct( ...
        'meanWait', mean(waiting), ...
        'p95Wait', sortedWaiting(percentileIndex), ...
        'utilization', simulation.utilization, ...
        'probabilityOfWait', mean(waiting > 1e-12), ...
        'maxQueue', max(simulation.queueAtArrival(firstIndex:end)));
end
