function style_demo_axes(ax)
%STYLE_DEMO_AXES 统一案例图表的坐标轴样式。

    if nargin < 1 || isempty(ax)
        ax = gca;
    end

    textColor = [0.20 0.26 0.35];
    set(ax, ...
        'Color', [1 1 1], ...
        'XColor', textColor, ...
        'YColor', textColor, ...
        'LineWidth', 0.8, ...
        'FontSize', 10);
    if isprop(ax, 'ZColor')
        set(ax, 'ZColor', textColor);
    end
    if isprop(ax, 'GridColor')
        set(ax, 'GridColor', [0.82 0.86 0.91]);
    end
    if isprop(ax, 'GridAlpha')
        set(ax, 'GridAlpha', 0.55);
    end
    grid(ax, 'on');
    box(ax, 'off');

    set(get(ax, 'Title'), 'Color', [0.08 0.13 0.24]);
    set(get(ax, 'XLabel'), 'Color', textColor);
    set(get(ax, 'YLabel'), 'Color', textColor);
    if isprop(ax, 'ZLabel')
        set(get(ax, 'ZLabel'), 'Color', textColor);
    end
end
