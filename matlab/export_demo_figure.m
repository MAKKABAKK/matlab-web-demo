function export_demo_figure(fig, outputPath)
%EXPORT_DEMO_FIGURE 以 PNG 导出图表，并兼容较旧 MATLAB。

    if nargin < 2 || ~ishandle(fig) || ~ischar(outputPath)
        error('Demo:InvalidFigureExport', ...
            'A valid figure handle and output path are required.');
    end

    outputDir = fileparts(outputPath);
    if ~exist(outputDir, 'dir')
        mkdir(outputDir);
    end

    set(fig, 'Color', [1 1 1]);
    drawnow;
    try
        exportgraphics(fig, outputPath, 'Resolution', 150);
    catch
        set(fig, 'PaperPositionMode', 'auto');
        print(fig, outputPath, '-dpng', '-r150');
    end

    fileInfo = dir(outputPath);
    if isempty(fileInfo) || fileInfo.bytes == 0
        error('Demo:FigureExportFailed', ...
            'Figure export did not create a valid file: %s', outputPath);
    end
end
