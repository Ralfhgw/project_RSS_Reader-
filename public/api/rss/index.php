<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Vary: Origin");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

$url = isset($_GET["url"]) ? trim((string) $_GET["url"]) : "";

if ($url === "") {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => "Missing url query parameter."], JSON_UNESCAPED_SLASHES);
    exit;
}

if (filter_var($url, FILTER_VALIDATE_URL) === false) {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => "Invalid url query parameter."], JSON_UNESCAPED_SLASHES);
    exit;
}

$scheme = (string) parse_url($url, PHP_URL_SCHEME);
if (!in_array(strtolower($scheme), ["http", "https"], true)) {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => "Only http and https URLs are supported."], JSON_UNESCAPED_SLASHES);
    exit;
}

$accept = "application/rss+xml, application/xml, text/xml, application/atom+xml, */*";
$userAgent = "Mozilla/5.0 (compatible; PulseboardRSS/1.0; +https://example.com)";
$responseBody = false;
$statusCode = 502;
$contentType = "application/xml; charset=utf-8";

if (function_exists("curl_init")) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            "Accept: " . $accept,
            "User-Agent: " . $userAgent,
        ],
    ]);

    $responseBody = curl_exec($ch);

    if ($responseBody !== false) {
        $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $rawContentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        if (is_string($rawContentType) && $rawContentType !== "") {
            $contentType = $rawContentType;
        }
    }

    if ($responseBody === false) {
        http_response_code(502);
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode(["error" => "RSS proxy request failed.", "details" => curl_error($ch)], JSON_UNESCAPED_SLASHES);
        curl_close($ch);
        exit;
    }

    curl_close($ch);
} else {
    $context = stream_context_create([
        "http" => [
            "method" => "GET",
            "timeout" => 20,
            "ignore_errors" => true,
            "header" => "Accept: " . $accept . "\r\n" . "User-Agent: " . $userAgent . "\r\n",
        ],
    ]);

    $responseBody = @file_get_contents($url, false, $context);

    if ($responseBody === false) {
        http_response_code(502);
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode(["error" => "RSS proxy request failed."], JSON_UNESCAPED_SLASHES);
        exit;
    }

    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $headerLine) {
            if (preg_match("~^HTTP/\S+\s+(\d{3})~", $headerLine, $matches) === 1) {
                $statusCode = (int) $matches[1];
            }

            if (stripos($headerLine, "Content-Type:") === 0) {
                $contentType = trim(substr($headerLine, 13));
            }
        }
    }
}

http_response_code($statusCode > 0 ? $statusCode : 200);
header("Content-Type: " . $contentType);
header("Cache-Control: public, s-maxage=300, stale-while-revalidate=600");
echo $responseBody;