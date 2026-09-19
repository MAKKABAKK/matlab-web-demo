function bundle = build_heat_diffusion()
%BUILD_HEAT_DIFFUSION 构建稳定的热扩散案例与稳定性测试。

    [initialTemperature, xGrid, yGrid, ambient] = initial_temperature_demo(61);
    stabilityRatio = 0.20;
    numSteps = 300;
    snapshotSteps = [0, 25, 100, 300];
    simulation = simulate_heat_diffusion_demo( ...
        initialTemperature, ambient, stabilityRatio, numSteps, snapshotSteps);
    stabilityTests = evaluate_heat_stability_demo( ...
        initialTemperature, ambient, [0.10, 0.20, 0.24, 0.28], 180);

    initialPeak = simulation.peak(1);
    finalPeak = simulation.peak(end);
    halfTarget = ambient + 0.5 * (initialPeak - ambient);
    halfIndex = find(simulation.peak <= halfTarget, 1);
    if isempty(halfIndex)
        halfCoolingStep = numSteps;
    else
        halfCoolingStep = halfIndex - 1;
    end

    metrics = struct( ...
        'initialPeak', round(initialPeak, 3), ...
        'finalPeak', round(finalPeak, 3), ...
        'halfCoolingStep', halfCoolingStep, ...
        'energyRetainedPercent', round( ...
            100 * simulation.energy(end) / simulation.energy(1), 3), ...
        'stabilityRatio', stabilityRatio);

    snapshots = repmat(struct( ...
        'step', 0, 'peak', 0, 'mean', 0, 'energy', 0), ...
        1, numel(snapshotSteps));
    for index = 1:numel(snapshotSteps)
        resultIndex = snapshotSteps(index) + 1;
        snapshots(index).step = snapshotSteps(index);
        snapshots(index).peak = round(simulation.peak(resultIndex), 3);
        snapshots(index).mean = round(simulation.meanTemperature(resultIndex), 3);
        snapshots(index).energy = round(simulation.energy(resultIndex), 3);
    end

    bundle = struct();
    bundle.results = struct( ...
        'metrics', metrics, ...
        'snapshots', snapshots, ...
        'stabilityTests', stabilityTests);
    bundle.figures = create_heat_figures( ...
        simulation, xGrid, yGrid, ambient, stabilityTests);
end
