function publish_project(project)
%PUBLISH_PROJECT 发布一个标准 MATLAB 代码案例。
%   PROJECT 提供 id、title、sourceDir、sourceFiles 与 buildFunction。
%   buildFunction 返回 results 及 figures(file, handle)。

    validateProject(project);
    paths = demo_project_paths(project.id);
    ensureFolder(paths.dataDir);
    ensureFolder(paths.plotsDir);
    ensureFolder(paths.codeDir);

    fprintf('Generating %s assets...\n', project.id);
    bundle = project.buildFunction();
    validateBundle(bundle);
    figureCleanup = onCleanup(@() closeFigures(bundle.figures));

    publishTime = datetime('now');
    lastUpdated = char(datetime(publishTime, 'Format', 'yyyy-MM-dd HH:mm:ss'));
    publishVersion = char(datetime(publishTime, 'Format', 'yyyyMMdd-HHmmss'));

    results = bundle.results;
    results.project = project.title;
    results.lastUpdated = lastUpdated;

    exportFigures(bundle.figures, paths.plotsDir);
    writeJsonFile(fullfile(paths.dataDir, 'results.json'), results);
    copySourceFiles(project.sourceDir, project.sourceFiles, paths.codeDir);
    updateManifest(paths.manifestPath, project.id, lastUpdated, publishVersion);
    updateCatalog(paths.catalogPath, project.id, lastUpdated);

    clear figureCleanup;
    fprintf('Done: %s -> %s\n', project.id, paths.projectContentDir);
end

function validateProject(project)
%VALIDATEPROJECT 检查项目配置。
    required = {'id', 'title', 'sourceDir', 'sourceFiles', 'buildFunction'};
    if ~isstruct(project)
        error('Demo:InvalidProject', 'Project configuration must be a struct.');
    end
    for index = 1:numel(required)
        if ~isfield(project, required{index})
            error('Demo:InvalidProject', ...
                'Project configuration is missing %s.', required{index});
        end
    end
    demo_project_paths(project.id);
    if ~ischar(project.title) || isempty(project.title)
        error('Demo:InvalidProject', 'Project title must be non-empty text.');
    end
    if ~ischar(project.sourceDir) || ~exist(project.sourceDir, 'dir')
        error('Demo:InvalidProject', 'Project source directory does not exist.');
    end
    if ~iscell(project.sourceFiles) || isempty(project.sourceFiles)
        error('Demo:InvalidProject', 'sourceFiles must be a non-empty cell array.');
    end
    if ~isa(project.buildFunction, 'function_handle')
        error('Demo:InvalidProject', 'buildFunction must be a function handle.');
    end
end

function validateBundle(bundle)
%VALIDATEBUNDLE 检查项目构建结果。
    if ~isstruct(bundle) || ~isfield(bundle, 'results') || ...
            ~isfield(bundle, 'figures') || ~isstruct(bundle.results) || ...
            ~isstruct(bundle.figures) || isempty(bundle.figures)
        error('Demo:InvalidBundle', ...
            'Build output needs results and a non-empty figures array.');
    end
    if ~all(isfield(bundle.figures, {'file', 'handle'}))
        error('Demo:InvalidBundle', 'Each figure needs file and handle fields.');
    end

    fileNames = cell(1, numel(bundle.figures));
    for index = 1:numel(bundle.figures)
        fileNames{index} = bundle.figures(index).file;
        validateOutputName(fileNames{index});
        if ~ishandle(bundle.figures(index).handle)
            error('Demo:InvalidBundle', ...
                'Figure %s does not contain a valid handle.', fileNames{index});
        end
    end
    if numel(unique(fileNames)) ~= numel(fileNames)
        error('Demo:InvalidBundle', 'Figure filenames must be unique.');
    end
end

function validateOutputName(fileName)
%VALIDATEOUTPUTNAME 只允许发布到目标目录的普通文件名。
    if ~ischar(fileName) || isempty(regexp(fileName, ...
            '^[A-Za-z0-9][A-Za-z0-9._-]*$', 'once'))
        error('Demo:InvalidOutputName', ...
            'Output filenames may only contain letters, numbers, dot, dash, and underscore.');
    end
end

function exportFigures(figures, plotsDir)
%EXPORTFIGURES 导出构建函数返回的全部图表。
    for index = 1:numel(figures)
        export_demo_figure(figures(index).handle, ...
            fullfile(plotsDir, figures(index).file));
    end
end

function closeFigures(figures)
%CLOSEFIGURES 无论成功或失败都关闭项目图窗。
    for index = 1:numel(figures)
        if isfield(figures, 'handle') && ishandle(figures(index).handle)
            close(figures(index).handle);
        end
    end
end

function copySourceFiles(sourceDir, sourceFiles, codeDir)
%COPYSOURCEFILES 复制 manifest 可引用的项目源码。
    for index = 1:numel(sourceFiles)
        relativePath = sourceFiles{index};
        validateOutputName(relativePath);
        sourcePath = fullfile(sourceDir, relativePath);
        if ~exist(sourcePath, 'file')
            error('Demo:SourceMissing', 'Source file not found: %s', sourcePath);
        end
        copyfile(sourcePath, fullfile(codeDir, relativePath), 'f');
    end
end

function updateManifest(manifestPath, projectId, lastUpdated, publishVersion)
%UPDATEMANIFEST 使用结构化 JSON 更新版本资料。
    if ~exist(manifestPath, 'file')
        warning('Demo:ManifestMissing', ...
            'Manifest not found; generated assets remain available: %s', manifestPath);
        return;
    end
    originalText = fileread(manifestPath);
    manifest = jsondecode(originalText);
    if ~isfield(manifest, 'id') || ~strcmp(manifest.id, projectId)
        error('Demo:ManifestMismatch', ...
            'Manifest ID does not match project %s.', projectId);
    end
    manifest.version = publishVersion;
    manifest.lastUpdated = lastUpdated;
    manifest = normalizeManifestArrays(manifest);
    writeJsonFile(manifestPath, manifest, originalText);
end

function manifest = normalizeManifestArrays(manifest)
%NORMALIZEMANIFESTARRAYS 保留只有一个元素时仍必须为阵列的内容字段。
    manifest.artifacts = asCellArray(manifest.artifacts);
    sections = asCellArray(manifest.sections);
    for index = 1:numel(sections)
        section = sections{index};
        section.blocks = normalizeBlocks(section.blocks);
        sections{index} = section;
    end
    manifest.sections = sections;
end

function blocks = normalizeBlocks(value)
%NORMALIZEBLOCKS 递归恢复区块、指标、步骤与栏位阵列。
    blocks = asCellArray(value);
    for index = 1:numel(blocks)
        block = blocks{index};
        if isfield(block, 'blocks')
            block.blocks = normalizeBlocks(block.blocks);
        end
        if isfield(block, 'items')
            block.items = asCellArray(block.items);
        end
        if isfield(block, 'columns')
            block.columns = asCellArray(block.columns);
        end
        blocks{index} = block;
    end
end

function values = asCellArray(value)
%ASCELLARRAY 让 jsonencode 明确保留 JSON 阵列语义。
    if iscell(value)
        values = value;
    else
        values = num2cell(value);
    end
end

function updateCatalog(catalogPath, projectId, lastUpdated)
%UPDATECATALOG 更新匹配项目；尚未登记时保留 catalog 不变。
    if ~exist(catalogPath, 'file')
        warning('Demo:CatalogMissing', 'Catalog not found: %s', catalogPath);
        return;
    end
    originalText = fileread(catalogPath);
    catalog = jsondecode(originalText);
    if ~isfield(catalog, 'categories')
        error('Demo:InvalidCatalog', 'Catalog has no categories collection.');
    end

    categories = asCellArray(catalog.categories);
    projectFound = false;
    for categoryIndex = 1:numel(categories)
        category = categories{categoryIndex};
        projects = asCellArray(category.projects);
        for index = 1:numel(projects)
            if isfield(projects{index}, 'id') && strcmp(projects{index}.id, projectId)
                projects{index}.lastUpdated = lastUpdated;
                projectFound = true;
            end
        end
        category.projects = projects;
        categories{categoryIndex} = category;
    end

    if ~projectFound
        warning('Demo:ProjectMissing', ...
            'Project %s is not registered in %s', projectId, catalogPath);
        return;
    end
    catalog.categories = categories;
    writeJsonFile(catalogPath, catalog, originalText);
end

function writeJsonFile(filePath, value, originalText)
%WRITEJSONFILE 以 UTF-8 写入 JSON。
    try
        jsonText = jsonencode(value, 'PrettyPrint', true);
    catch
        jsonText = jsonencode(value);
    end
    if nargin >= 3
        jsonText = restorePropertyNames(jsonText, originalText);
    end
    writeTextFile(filePath, jsonText);
end

function jsonText = restorePropertyNames(jsonText, originalText)
%RESTOREPROPERTYNAMES 保留 zh-Hant 等非 MATLAB 标识符 JSON 键。
    matches = regexp(originalText, ...
        '"([A-Za-z][A-Za-z0-9_.-]*)"\s*:', 'tokens');
    for index = 1:numel(matches)
        originalName = matches{index}{1};
        matlabName = matlab.lang.makeValidName(originalName);
        if ~strcmp(originalName, matlabName)
            jsonText = strrep(jsonText, ...
                ['"', matlabName, '":'], ['"', originalName, '":']);
        end
    end
end

function writeTextFile(filePath, textValue)
%WRITETEXTFILE 安全关闭输出文件。
    fileId = fopen(filePath, 'w', 'n', 'UTF-8');
    if fileId == -1
        error('Demo:FileWriteFailed', 'Could not write %s', filePath);
    end
    fileCleanup = onCleanup(@() fclose(fileId));
    fwrite(fileId, textValue, 'char');
    clear fileCleanup;
end

function ensureFolder(folderPath)
%ENSUREFOLDER 按需建立目录。
    if ~exist(folderPath, 'dir')
        mkdir(folderPath);
    end
end
