FROM eclipse-temurin:21-jre

WORKDIR /app
RUN mkdir -p /data/rooms && chown -R 10001:10001 /app /data
COPY --chown=10001:10001 server/build/libs/server-1.0.0.jar /app/belot-server.jar

ENV SERVER_PORT=8080
ENV BELOT_ROOMS_DIRECTORY=/data/rooms

EXPOSE 8080
USER 10001:10001
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/belot-server.jar"]
