function tests = evaluate_heat_stability_demo(initialTemperature, ambient, ratios, numSteps)
%EVALUATE_HEAT_STABILITY_DEMO 比较稳定阈值内外的更新比率。

    tests = repmat(struct( ...
        'ratio', 0, 'status', '', 'maxTemperature', 0), 1, numel(ratios));
    for index = 1:numel(ratios)
        ratio = ratios(index);
        temperature = initialTemperature;
        maximumObserved = max(temperature(:));
        for step = 1:numSteps
            updated = temperature;
            updated(2:end - 1, 2:end - 1) = temperature(2:end - 1, 2:end - 1) + ...
                ratio * ( ...
                temperature(1:end - 2, 2:end - 1) + ...
                temperature(3:end, 2:end - 1) + ...
                temperature(2:end - 1, 1:end - 2) + ...
                temperature(2:end - 1, 3:end) - ...
                4 * temperature(2:end - 1, 2:end - 1));
            updated([1 end], :) = ambient;
            updated(:, [1 end]) = ambient;
            temperature = updated;
            maximumObserved = max(maximumObserved, max(abs(temperature(:))));
            if ~all(isfinite(temperature(:))) || maximumObserved > 1e8
                break;
            end
        end
        tests(index).ratio = round(ratio, 2);
        if ratio <= 0.25
            tests(index).status = 'Stable';
        else
            tests(index).status = 'Unstable';
        end
        tests(index).maxTemperature = round(maximumObserved, 3);
    end
end
