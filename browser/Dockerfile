FROM selenium/standalone-chromium:latest

COPY policies/sentinel.json /etc/chromium/policies/managed/sentinel.json

# Sentinel provides the recording controls; noVNC only supplies the remote display and input surface.
USER root
RUN printf '\n#noVNC_control_bar_anchor, #noVNC_hint_anchor { display: none !important; }\n' >> /opt/bin/noVNC/app/styles/base.css
USER seluser
