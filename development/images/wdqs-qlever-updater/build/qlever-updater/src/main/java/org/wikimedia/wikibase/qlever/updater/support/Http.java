package org.wikimedia.wikibase.qlever.updater.support;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/** Bounded HTTP requests with errors that retain the response status code. */
public final class Http {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);
    private static final HttpClient CLIENT =
            HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();

    private Http() {}

    public static String get(final String url, final Map<String, String> headers) throws Exception {
        return request(url, "GET", null, headers);
    }

    public static String request(
            final String url, final String method, final String body, final Map<String, String> headers)
            throws Exception {
        final HttpRequest.BodyPublisher publisher =
                body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body);
        final HttpRequest.Builder request =
                HttpRequest.newBuilder(URI.create(url)).timeout(REQUEST_TIMEOUT).method(method, publisher);
        headers.forEach(request::header);
        final HttpResponse<String> response =
                CLIENT.send(request.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new HttpException(response.statusCode(), method + " " + url + ": " + response.body());
        }
        return response.body();
    }

    public static String query(final Map<String, String> parameters) {
        return parameters.entrySet().stream()
                .map(
                        entry ->
                                URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                                        + "="
                                        + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
    }

    /** A non-success response returned by a remote HTTP endpoint. */
    public static final class HttpException extends Exception {
        private final int status;

        public HttpException(final int status, final String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }
    }
}
