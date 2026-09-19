function figures = create_heat_figures( ...
        simulation, xGrid, yGrid, ambient, stabilityTests)
%CREATE_HEAT_FIGURES 建立快照、曲面、能量与稳定性图。

    actualColor = [0.08 0.31 0.77];
    accentColor = [0.00 0.65 0.63];
    warningColor = [0.91 0.45 0.12];
    figurePosition = [100 100 1100 720];
    figures = repmat(struct('file', '', 'handle', []), 1, 4);
    colorLimits = [ambient, max(simulation.initialTemperature(:))];

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    for index = 1:numel(simulation.snapshotSteps)
        subplot(2, 2, index);
        imagesc(simulation.snapshots(:, :, index));
        axis image;
        set(gca, 'YDir', 'normal');
        set(gca, 'CLim', colorLimits);
        colorbar;
        title(sprintf('Step %d', simulation.snapshotSteps(index)));
        xlabel('Grid x'); ylabel('Grid y');
        style_demo_axes(gca);
    end
    figures(1) = struct('file', 'heat_snapshots.png', 'handle', fig);

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    subplot(1, 2, 1);
    surf(xGrid, yGrid, simulation.initialTemperature, 'EdgeColor', 'none');
    set(gca, 'CLim', colorLimits); colorbar; view(38, 30);
    title('Initial Temperature');
    xlabel('x'); ylabel('y'); zlabel('Temperature');
    style_demo_axes(gca);
    subplot(1, 2, 2);
    surf(xGrid, yGrid, simulation.finalTemperature, 'EdgeColor', 'none');
    set(gca, 'CLim', colorLimits); colorbar; view(38, 30);
    title('Final Temperature');
    xlabel('x'); ylabel('y'); zlabel('Temperature');
    style_demo_axes(gca);
    figures(2) = struct('file', 'temperature_surface.png', 'handle', fig);

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    subplot(1, 2, 1);
    plot(simulation.steps, 100 * simulation.energy / simulation.energy(1), ...
        'Color', actualColor, 'LineWidth', 1.8);
    title('Excess Heat Retained');
    xlabel('Step'); ylabel('Percent');
    style_demo_axes(gca);
    subplot(1, 2, 2);
    plot(simulation.steps, simulation.peak, ...
        'Color', accentColor, 'LineWidth', 1.8);
    title('Peak Temperature Decay');
    xlabel('Step'); ylabel('Temperature');
    style_demo_axes(gca);
    figures(3) = struct('file', 'energy_decay.png', 'handle', fig);

    fig = figure('Visible', 'off', 'Color', [1 1 1], ...
        'Position', figurePosition);
    ratios = [stabilityTests.ratio];
    observed = [stabilityTests.maxTemperature];
    semilogy(ratios, observed, 'o-', ...
        'Color', warningColor, 'MarkerFaceColor', warningColor, 'LineWidth', 1.7);
    hold on;
    currentLimits = ylim;
    plot([0.25 0.25], currentLimits, '--', ...
        'Color', actualColor, 'LineWidth', 1.5);
    hold off;
    title('Explicit Scheme Stability');
    xlabel('Diffusion ratio'); ylabel('Maximum absolute temperature');
    legend({'Observed magnitude', 'Stability limit'}, 'Location', 'best');
    style_demo_axes(gca);
    figures(4) = struct('file', 'stability_comparison.png', 'handle', fig);
end
