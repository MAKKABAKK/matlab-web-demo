%% Passenger Flow Forecasting
% Self-contained demo. No external data files are required.

clear; clc; close all;
rng(42);

%% Generate synthetic hourly passenger-flow data
n = 24 * 14;
t = (1:n)';
hourOfDay = mod(t - 1, 24);

dailyPattern = 420 * sin(2*pi*(hourOfDay - 7)/24) ...
             + 260 * sin(4*pi*(hourOfDay - 8)/24);
trend = 0.65 * t;
noise = 110 * randn(n, 1);
passengerFlow = max(250, 1450 + dailyPattern + trend + noise);

%% Train/test split
horizon = 48;
lag = 24;
trainData = passengerFlow(1:end-horizon);
testData = passengerFlow(end-horizon+1:end);

%% Forecast
prediction = forecast(trainData, horizon, lag);
baseline = repmat(trainData(end), horizon, 1);

rmseModel = sqrt(mean((testData - prediction).^2));
maeModel = mean(abs(testData - prediction));
rmseBaseline = sqrt(mean((testData - baseline).^2));
maeBaseline = mean(abs(testData - baseline));

fprintf('Autoregressive RMSE: %.2f\n', rmseModel);
fprintf('Autoregressive MAE : %.2f\n', maeModel);

%% Forecast result
figure('Color','w','Position',[100 100 980 480]);
plot(t, passengerFlow, 'LineWidth', 1.1); hold on;
forecastIndex = (n-horizon+1:n)';
plot(forecastIndex, prediction, '--', 'LineWidth', 1.8);
xline(n-horizon, ':', 'Forecast start');
xlabel('Time (hours)');
ylabel('Passenger flow');
title('Passenger Flow Forecasting Result');
legend('Observed', 'Forecast', 'Location', 'best');
grid on;
exportgraphics(gcf, 'result.png', 'Resolution', 160);

%% Model comparison
figure('Color','w','Position',[100 100 720 460]);
metrics = [rmseBaseline rmseModel; maeBaseline maeModel];
bar(metrics);
set(gca, 'XTickLabel', {'RMSE','MAE'});
ylabel('Error');
title('Forecast Model Comparison');
legend('Last-value baseline', 'Autoregressive', 'Location', 'best');
grid on;
exportgraphics(gcf, 'comparison.jpg', 'Resolution', 160);
